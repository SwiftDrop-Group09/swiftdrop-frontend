import { describe, expect, it, vi } from 'vitest';
import { MerchantOrdersApi, MerchantOrdersError } from './api';
import { acceptedOrder, createdOrder, dashboard, page } from './test-fixtures';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiReturning(response: Response | (() => Promise<Response>)) {
  const fetcher = vi.fn<typeof fetch>(() =>
    typeof response === 'function' ? response() : Promise.resolve(response),
  );
  return { api: new MerchantOrdersApi(fetcher), fetcher };
}

describe('MerchantOrdersApi', () => {
  it('lists orders with paging and an optional state filter', async () => {
    const { api, fetcher } = apiReturning(
      json(page([acceptedOrder, createdOrder], 2)),
    );

    const result = await api.listOrders({
      page: 2,
      pageSize: 50,
      state: 'Created',
    });

    expect(result.items).toHaveLength(2);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      '/api/v1/merchant/orders?page=2&pageSize=50&state=Created',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });
  });

  it('omits the state filter when none is chosen', async () => {
    const { api, fetcher } = apiReturning(json(page([])));

    await api.listOrders({ page: 1, pageSize: 20 });

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      '/api/v1/merchant/orders?page=1&pageSize=20',
    );
  });

  it('reads one order by id', async () => {
    const { api, fetcher } = apiReturning(json(createdOrder));

    const order = await api.getOrder(createdOrder.id);

    expect(order.trackingNumber).toBe('SD-FICTION-01');
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `/api/v1/merchant/orders/${createdOrder.id}`,
    );
  });

  it('rejects a malformed order id without calling the server', async () => {
    const { api, fetcher } = apiReturning(json(createdOrder));

    await expect(api.getOrder('../merchants')).rejects.toMatchObject({
      code: 'order_not_found',
      status: 404,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('turns problem details into a readable error', async () => {
    const { api } = apiReturning(
      json({ code: 'order_not_found', status: 404 }, 404),
    );

    const error = await api
      .getOrder(createdOrder.id)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MerchantOrdersError);
    expect(error).toMatchObject({ code: 'order_not_found', status: 404 });
    expect((error as Error).message).toMatch(/not found/i);
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [500, 'request_failed'],
  ])(
    'falls back to a status-based code when the body is not a problem (%i)',
    async (status, code) => {
      const { api } = apiReturning(new Response('oops', { status }));

      await expect(
        api.listOrders({ page: 1, pageSize: 20 }),
      ).rejects.toMatchObject({ code, status });
    },
  );

  it('rejects a response that does not match the contract', async () => {
    const { api } = apiReturning(
      json({ items: [{ id: 'nope' }], totalCount: 1, page: 1, pageSize: 20 }),
    );

    await expect(
      api.listOrders({ page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('reports network failures without leaking details', async () => {
    const { api } = apiReturning(() =>
      Promise.reject(new TypeError('Failed to fetch')),
    );

    await expect(
      api.listOrders({ page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ code: 'network_error' });
  });

  it('reads the dashboard for a UTC window', async () => {
    const { api, fetcher } = apiReturning(json(dashboard));

    const result = await api.getDashboard({
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-14T00:00:00Z',
    });

    expect(result.successRate).toBe(0.8824);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      '/api/v1/merchants/me/dashboard?from=2026-11-01T00%3A00%3A00Z&to=2026-11-14T00%3A00%3A00Z',
    );
  });

  it('tolerates an unknown parcel status in the dashboard counts', async () => {
    const { api } = apiReturning(
      json({
        ...dashboard,
        statusCounts: { ...dashboard.statusCounts, Returned: 1 },
      }),
    );

    await expect(
      api.getDashboard({ from: 'a', to: 'b' }),
    ).resolves.toMatchObject({ totalOrders: 42 });
  });

  it('only accepts same-origin base paths', () => {
    expect(
      () => new MerchantOrdersApi(fetch, 'https://evil.example'),
    ).toThrow();
    expect(() => new MerchantOrdersApi(fetch, '//evil.example')).toThrow();
  });
});
