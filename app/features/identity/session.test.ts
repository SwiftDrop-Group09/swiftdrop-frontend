import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdentityApi, IdentityError } from './api';
import { IdentitySession } from './session';
import { admin, customer, json, pair } from './test-fixtures';

afterEach(() => vi.unstubAllGlobals());
describe('one in-memory session', () => {
  it('clears privileged caches when refreshed server roles change', async () => {
    const api = new IdentityApi();
    const clear = vi.fn();
    vi.spyOn(api, 'refresh')
      .mockResolvedValueOnce(pair(admin))
      .mockResolvedValueOnce(pair({ ...admin, roles: ['Customer'] }));
    const session = new IdentitySession(api, clear);
    await session.restore();
    await session.refresh();
    expect(clear).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot().user?.roles).toEqual(['Customer']);
  });
  it('rejects a prior account response after logout and new login', async () => {
    const api = new IdentityApi();
    vi.spyOn(api, 'refresh').mockResolvedValue(pair());
    vi.spyOn(api, 'logout').mockResolvedValue();
    vi.spyOn(api, 'login').mockResolvedValue(pair(admin));
    const session = new IdentitySession(api);
    await session.restore();
    let finish!: (profile: typeof customer) => void;
    const operation = session.authorized(
      () =>
        new Promise<typeof customer>((resolve) => {
          finish = resolve;
        }),
    );
    await Promise.resolve();
    await session.logout();
    await session.login(admin.email, 'private-password');
    finish(customer);
    await expect(operation).rejects.toMatchObject({ code: 'session_changed' });
    expect(session.getSnapshot().user).toEqual(admin);
  });
  it('preserves Request idempotency and content headers when adding authentication', async () => {
    const api = new IdentityApi();
    vi.spyOn(api, 'refresh').mockResolvedValue(pair());
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ accepted: true }, 201));
    vi.stubGlobal('fetch', fetcher);
    const session = new IdentitySession(api);
    await session.restore();
    await session.authenticatedRequest(
      new Request(new URL('/api/v1/parcels', window.location.origin), {
        method: 'POST',
        body: '{}',
        headers: {
          'Idempotency-Key': 'stable-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    const headers = new Headers(fetcher.mock.calls[0]![1]!.headers);
    expect(headers.get('Idempotency-Key')).toBe('stable-key');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer access-token');
  });
  it('shares refresh across simultaneous requests', async () => {
    const api = new IdentityApi();
    const refresh = vi.spyOn(api, 'refresh').mockResolvedValue(pair());
    const session = new IdentitySession(api);
    const results = await Promise.all([
      session.accessToken(),
      session.accessToken(),
      session.accessToken(),
    ]);
    expect(results).toEqual(['access-token', 'access-token', 'access-token']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('restores once and retains access only in memory', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const api = new IdentityApi();
    vi.spyOn(api, 'refresh').mockResolvedValue(pair());
    const session = new IdentitySession(api);
    await Promise.all([session.restore(), session.restore()]);
    expect(session.getSnapshot()).toMatchObject({
      user: customer,
      restoring: false,
    });
    expect(storage).not.toHaveBeenCalled();
    expect(JSON.stringify(session.getSnapshot())).not.toContain('access-token');
  });
  it('refreshes shortly before access expiration', async () => {
    let now = 0;
    const api = new IdentityApi();
    vi.spyOn(api, 'refresh')
      .mockResolvedValueOnce(pair())
      .mockResolvedValueOnce(pair(customer, 'replacement'));
    const session = new IdentitySession(api, undefined, () => now);
    await session.restore();
    now = 880_000;
    expect(await session.accessToken()).toBe('replacement');
  });
  it('clears private caches and user state after refresh rejection', async () => {
    const api = new IdentityApi();
    const clear = vi.fn();
    vi.spyOn(api, 'refresh')
      .mockResolvedValueOnce(pair())
      .mockRejectedValueOnce(new IdentityError('invalid_credentials', 401));
    const session = new IdentitySession(api, clear);
    await session.restore();
    await expect(session.refresh()).rejects.toThrow();
    expect(session.getSnapshot().user).toBeNull();
    expect(clear).toHaveBeenCalledTimes(2);
  });
  it('does not resurrect a session when pending login finishes after logout', async () => {
    const api = new IdentityApi();
    vi.spyOn(api, 'refresh').mockResolvedValue(pair());
    vi.spyOn(api, 'logout').mockResolvedValue();
    let finish!: (value: ReturnType<typeof pair>) => void;
    vi.spyOn(api, 'login').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const session = new IdentitySession(api);
    await session.restore();
    const login = session.login(admin.email, 'secret-password');
    await session.logout();
    finish(pair(admin));
    await expect(login).rejects.toMatchObject({ code: 'session_changed' });
    expect(session.getSnapshot().user).toBeNull();
  });
  it('clears locally and reports unconfirmed server logout on network failure', async () => {
    const api = new IdentityApi();
    vi.spyOn(api, 'refresh').mockResolvedValue(pair());
    vi.spyOn(api, 'logout').mockRejectedValue(
      new IdentityError('network_error'),
    );
    const session = new IdentitySession(api);
    await session.restore();
    await expect(session.logout()).rejects.toMatchObject({
      code: 'logout_unconfirmed',
    });
    expect(session.getSnapshot().user).toBeNull();
  });
  it('clears inactive/demoted users on privileged API rejection without replay', async () => {
    const api = new IdentityApi();
    vi.spyOn(api, 'refresh').mockResolvedValue(pair(admin));
    const session = new IdentitySession(api);
    await session.restore();
    const operation = vi
      .fn()
      .mockRejectedValue(new IdentityError('forbidden', 403));
    await expect(session.authorized(operation)).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().user).toBeNull();
  });
  it('retries only a GET once following access rejection', async () => {
    const api = new IdentityApi();
    vi.spyOn(api, 'refresh')
      .mockResolvedValueOnce(pair())
      .mockResolvedValueOnce(pair(customer, 'new-access'));
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal('fetch', fetcher);
    const session = new IdentitySession(api);
    await session.restore();
    expect((await session.authenticatedRequest('/api/v1/parcels')).status).toBe(
      200,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      new Headers(fetcher.mock.calls[1]![1]!.headers).get('Authorization'),
    ).toBe('Bearer new-access');
  });
  it('does not replay a mutation when an access response is rejected', async () => {
    const api = new IdentityApi();
    vi.spyOn(api, 'refresh').mockResolvedValue(pair());
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ code: 'invalid_credentials' }, 401));
    vi.stubGlobal('fetch', fetcher);
    const session = new IdentitySession(api);
    await session.restore();
    await expect(
      session.authenticatedRequest('/api/v1/parcels', {
        method: 'POST',
        body: '{}',
      }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().user).toBeNull();
  });
  it('refuses to send bearer tokens to another origin or unrelated path', async () => {
    const session = new IdentitySession(new IdentityApi());
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      session.authenticatedRequest('https://attacker.test/api/v1/users'),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(session.authenticatedRequest('/unrelated')).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
