import { describe, expect, it, vi } from 'vitest';
import { IdentityApi, IdentityError } from './api';
import { csrf, customer, json, pair } from './test-fixtures';

describe('browser Identity API', () => {
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
      'The request could not be completed',
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
  it('rejects malformed session responses and excessive lifetimes', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(csrf))
      .mockResolvedValueOnce(json({ ...pair(), expiresInSeconds: 3600 }));
    await expect(new IdentityApi(fetcher).refresh()).rejects.toThrow();
  });
});
