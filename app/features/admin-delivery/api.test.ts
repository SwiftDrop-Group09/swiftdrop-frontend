import { describe, expect, it, vi } from 'vitest';
import { IdentityApi } from '~/features/identity/api';
import { IdentitySession } from '~/features/identity/session';
import { createAdminDeliveryApi } from './api';

function setup(response: Response) {
  const session = new IdentitySession(
    new IdentityApi(undefined, '/custom-api'),
  );
  const request = vi
    .spyOn(session, 'authenticatedRequest')
    .mockResolvedValue(response);
  return { api: createAdminDeliveryApi(session), request };
}

describe('real Delivery administration transport', () => {
  it('requires filter-capable response metadata when searching to avoid silently unfiltered results', async () => {
    const { api } = setup(
      Response.json({ items: [], totalCount: 0, page: 1, pageSize: 20 }),
    );
    await expect(
      api.listZones(1, 20, { search: 'Galle' }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('encodes global zone criteria through the authenticated transport', async () => {
    const { api, request } = setup(
      Response.json({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        cities: ['Colombo', 'Galle'],
      }),
    );
    await api.listZones(2, 20, {
      search: '00100',
      notCity: 'Colombo',
      status: 'inactive',
    });
    expect(request).toHaveBeenCalledWith(
      '/custom-api/v1/zones?page=2&pageSize=20&search=00100&notCity=Colombo&status=inactive',
      undefined,
    );
  });
  it('uses the shared authenticated transport and configured base', async () => {
    const { api, request } = setup(
      Response.json({ items: [], totalCount: 0, page: 1, pageSize: 20 }),
    );
    await expect(api.listZones()).resolves.toMatchObject({
      items: [],
      totalCount: 0,
    });
    expect(request).toHaveBeenCalledWith(
      '/custom-api/v1/zones?page=1&pageSize=20',
      undefined,
    );
  });

  it.each([401, 403, 409, 503])(
    'never invents a successful catalog on HTTP %s',
    async (status) => {
      const { api } = setup(
        Response.json(
          { code: 'delivery_unavailable', detail: 'PRIVATE SERVER DIAGNOSTIC' },
          { status },
        ),
      );
      await expect(api.listZones()).rejects.toMatchObject({ status });
    },
  );

  it('never invents a successful create after a network failure', async () => {
    const { api, request } = setup(Response.json({}));
    request.mockRejectedValue(new TypeError('offline'));
    await expect(
      api.createZone({
        name: 'Colombo',
        servicePostalCodes: [],
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: 'delivery_unavailable' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed success responses instead of fabricating report totals', async () => {
    const { api } = setup(Response.json({ from: 'not a complete report' }));
    await expect(api.getDeliveryReport()).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('includes the reviewed persisted version when changing tier status', async () => {
    const { api, request } = setup(
      Response.json({ code: 'conflict' }, { status: 409 }),
    );
    await expect(
      api.updatePricingTierStatus('tier-id', false, 42),
    ).rejects.toMatchObject({ status: 409 });
    expect(request.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ isActive: false, expectedVersion: 42 }),
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});
