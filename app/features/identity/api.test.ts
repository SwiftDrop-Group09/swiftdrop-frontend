import { describe, expect, it, vi } from 'vitest';
import { IdentityApi, IdentityError } from './api';
import { csrf, customer, json, pair } from './test-fixtures';

describe('browser Identity API', () => {
  it('explains outdated filter APIs without silently returning unfiltered users', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ code: 'validation_failed' }, 400));
    await expect(
      new IdentityApi(fetcher).users('token', 1, { role: 'Customer' }),
    ).rejects.toThrow('Restart the backend');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bootstraps CSRF and uses cookie refresh without any JSON token', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(csrf))
      .mockResolvedValueOnce(json(pair()));
    const api = new IdentityApi(fetcher);
    await api.refresh();
    expect(fetcher.mock.calls[0]![0]).toBe('/api/v1/auth/csrf');
    expect(fetcher.mock.calls[1]![0]).toBe('/api/v1/auth/refresh');
    const options = fetcher.mock.calls[1]![1]!;
    expect(options).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
      method: 'POST',
      body: '{}',
    });
    expect(options.headers).toMatchObject({ 'X-CSRF-Token': csrf.csrfToken });
    expect(JSON.stringify(options)).not.toContain('refreshToken');
  });
  it('never submits a mutation when browser verification fails', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ code: 'csrf_rejected' }, 403));
    await expect(
      new IdentityApi(fetcher).login(customer.email, 'a-private-password'),
    ).rejects.toMatchObject({ code: 'csrf_rejected' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('shares concurrent bootstrap requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(csrf));
    const api = new IdentityApi(fetcher);
    await Promise.all([api.bootstrap(), api.bootstrap(true)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    'https://untrusted.test/api',
    '//untrusted.test/api',
    '/api?token=unsafe',
    '/api\\evil',
  ])('rejects unsafe browser API base %s', (base) => {
    expect(() => new IdentityApi(undefined, base)).toThrow('same-origin');
  });
  it('sends only documented editable self-profile fields with bearer and CSRF', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(csrf))
      .mockResolvedValueOnce(json(customer));
    await new IdentityApi(fetcher).updateProfile('access', {
      fullName: 'Updated',
      phoneNumber: '',
      address: '',
    });
    expect(fetcher.mock.calls[1]).toEqual([
      '/api/v1/users/me',
      expect.objectContaining({
        method: 'PUT',
        body: '{"fullName":"Updated","phoneNumber":"","address":""}',
        headers: expect.objectContaining({
          Authorization: 'Bearer access',
          'X-CSRF-Token': csrf.csrfToken,
        }) as unknown,
      }),
    ]);
  });
  it('keeps create-only password out of Admin update bodies', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(csrf))
      .mockResolvedValueOnce(json(customer));
    await new IdentityApi(fetcher).updateUser('admin', customer.id, {
      email: customer.email,
      fullName: 'Updated',
      isActive: true,
    });
    expect(fetcher.mock.calls[1]![1]!.body).not.toContain('password');
  });
  it('uses canonical pagination without invented filters', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json({ items: [customer], page: 2, pageSize: 20, totalCount: 21 }),
      );
    await new IdentityApi(fetcher).users('admin', 2);
    expect(fetcher.mock.calls[0]![0]).toBe('/api/v1/users?page=2&pageSize=20');
  });
  it('redacts raw server detail and transport failures', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(csrf))
      .mockResolvedValueOnce(
        json(
          { code: 'invalid_credentials', detail: 'secret token@example.test' },
          401,
        ),
      );
    await expect(
      new IdentityApi(fetcher).login(customer.email, 'private-password'),
    ).rejects.toThrow('Sign-in failed');
    fetcher.mockRejectedValue(new Error('secret-network-error'));
    await expect(new IdentityApi(fetcher).bootstrap()).rejects.toThrow(
      'Unable to reach SwiftDrop',
    );
  });
  it('bounds UTF-8 request bodies before network mutation', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      new IdentityApi(fetcher).updateProfile('access', {
        fullName: 'Name',
        phoneNumber: '',
        address: '😀'.repeat(5000),
      }),
    ).rejects.toBeInstanceOf(IdentityError);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves an audit outage and recovers bootstrap only on an explicit retry', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json(
          { code: 'audit_unavailable', detail: 'private database detail' },
          503,
        ),
      )
      .mockResolvedValueOnce(json(csrf))
      .mockResolvedValueOnce(json(pair()));
    const api = new IdentityApi(fetcher);
    await expect(
      api.login(customer.email, 'private-password'),
    ).rejects.toMatchObject({
      code: 'audit_unavailable',
      status: 503,
      message:
        'Account services are temporarily unavailable. Please try again later.',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![1]!.method).toBe('GET');
    await api.login(customer.email, 'private-password');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/auth/csrf',
      '/api/v1/auth/csrf',
      '/api/v1/auth/login',
    ]);
    expect(fetcher.mock.calls[2]![1]!.headers).toMatchObject({
      'X-CSRF-Token': csrf.csrfToken,
    });
  });
  it.each([
    [503, 'Account services are temporarily unavailable.'],
    [502, 'Account services are temporarily unavailable.'],
    [429, 'Too many attempts.'],
    [504, 'The request timed out.'],
  ])(
    'handles a non-JSON HTTP %s error without blaming the connection or exposing the body',
    async (status, message) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('private-proxy-error', { status }));
      await expect(new IdentityApi(fetcher).bootstrap()).rejects.toMatchObject({
        status,
        message: expect.stringContaining(message) as unknown,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    json({ csrfToken: 'private-token' }),
    new Response('<html>private page</html>'),
  ])(
    'rejects a malformed successful bootstrap before sending credentials',
    async (response) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(
        new IdentityApi(fetcher).login(customer.email, 'private-password'),
      ).rejects.toMatchObject({
        code: 'invalid_response',
        message:
          'SwiftDrop returned an unexpected response. Please try again later.',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('distinguishes a request timeout from an offline connection', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new DOMException('private timeout details', 'TimeoutError'),
      );
    await expect(new IdentityApi(fetcher).bootstrap()).rejects.toMatchObject({
      code: 'request_timeout',
      message: 'The request timed out. Please try again.',
    });
  });
  it('rejects malformed session responses and excessive lifetimes', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(csrf))
      .mockResolvedValueOnce(json({ ...pair(), expiresInSeconds: 3600 }));
    await expect(new IdentityApi(fetcher).refresh()).rejects.toThrow();
  });
});
