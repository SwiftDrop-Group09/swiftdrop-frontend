import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdentityApi } from '~/features/identity/api';
import { IdentitySession } from '~/features/identity/session';
import { admin, customer, json, pair } from '~/features/identity/test-fixtures';
import { bookingEnvironmentFor } from './session-environment';

afterEach(() => vi.unstubAllGlobals());

describe('booking Identity adapter', () => {
  async function setup() {
    const api = new IdentityApi();
    vi.spyOn(api, 'refresh').mockResolvedValue(pair());
    vi.spyOn(api, 'logout').mockResolvedValue();
    vi.spyOn(api, 'login').mockResolvedValue(pair(admin));
    const session = new IdentitySession(api);
    await session.restore();
    const environment = bookingEnvironmentFor(session);
    environment.attempts.write({
      ownerId: customer.id,
      quoteId: customer.id,
      total: '2.50',
      key: 'original',
      body: 'original-body',
    });
    return { session, environment };
  }

  it('loads only the customer-safe zone projection using the shared bearer transport', async () => {
    const { environment } = await setup();
    const zones = [{ id: customer.id, name: 'Fixture area' }];
    const request = vi.fn<typeof fetch>().mockResolvedValue(json(zones));
    vi.stubGlobal('fetch', request);
    await expect(environment.zones.load()).resolves.toEqual(zones);
    expect(request.mock.calls[0]![0]).toBe('/api/v1/quotes/zones');
    const init = request.mock.calls[0]![1]!;
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer access-token',
    );
    expect(init.cache).toBe('no-store');
  });

  it('retains an uncertain confirmation across route adapters, then clears it on logout', async () => {
    const { session, environment } = await setup();
    expect(bookingEnvironmentFor(session).attempts.read(customer.id)?.key).toBe(
      'original',
    );
    await session.logout();
    expect(environment.attempts.read(customer.id)).toBeNull();
  });

  it.each(['roles', 'account'] as const)(
    'clears retained confirmations after a %s change',
    async (change) => {
      const { session, environment } = await setup();
      if (change === 'roles')
        session.updateUser({ ...customer, roles: ['Courier'] });
      else await session.login(admin.email, 'fixture-password');
      expect(environment.attempts.read(customer.id)).toBeNull();
    },
  );

  it('rejects malformed zone data rather than fabricating delivery areas', async () => {
    const { environment } = await setup();
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json([{ id: 'bad', name: 'Invalid' }])),
    );
    await expect(environment.zones.load()).rejects.toMatchObject({
      code: 'zones_unavailable',
    });
  });
});
