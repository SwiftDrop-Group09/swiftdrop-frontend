import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json } from '../identity/test-fixtures';
import {
  approvedBusiness,
  findText,
  mount,
  requestedUrls,
  type Fetcher,
} from './test-harness';
import {
  acceptedOrder,
  createdOrder,
  failedOrder,
  page,
  retryingOrder,
} from './test-fixtures';

const orderListCalls = (fetcher: Fetcher) =>
  requestedUrls(fetcher).filter((url) => url.includes('/v1/merchant/orders?'));

describe('Merchant orders list', () => {
  it('shows each order with its state, tracking link and parcel status', async () => {
    mount('/merchant/orders', (url) =>
      url.includes('/v1/merchant/orders?')
        ? json(page([createdOrder, acceptedOrder, failedOrder]))
        : undefined,
    );

    const row = (await findText('ORD-1002')).closest('tr')!;
    expect(within(row).getByText('Parcel created')).toBeInTheDocument();
    expect(
      within(row).getByRole('link', { name: 'SD-FICTION-01' }),
    ).toHaveAttribute('href', '/track?code=SD-FICTION-01');
    expect(within(row).getByText('In transit')).toBeInTheDocument();
    expect(within(row).getByText('2026-11-13 09:05 UTC')).toBeInTheDocument();

    const pending = screen.getByText('ORD-1001').closest('tr')!;
    expect(within(pending).getByText('Not yet assigned')).toBeInTheDocument();
    expect(within(pending).getByText('Received')).toBeInTheDocument();
    const failed = screen.getByText('ORD-1003').closest('tr')!;
    expect(within(failed).getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '3 orders · Page 1 of 1',
    );
  });

  it('explains how orders arrive when there are none yet', async () => {
    mount('/merchant/orders', (url) =>
      url.includes('/v1/merchant/orders?') ? json(page([])) : undefined,
    );

    expect(await findText('No orders yet')).toBeInTheDocument();
    expect(
      screen.getByText(/POST \/api\/v1\/merchant\/orders/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Manage API keys/ }),
    ).toHaveAttribute('href', '/merchant');
  });

  it('filters by state and keeps the filter in the URL', async () => {
    const user = userEvent.setup();
    const { fetcher, router } = mount('/merchant/orders', (url) =>
      url.includes('/v1/merchant/orders?')
        ? json(
            page(
              url.includes('state=Failed')
                ? [failedOrder]
                : [createdOrder, failedOrder],
            ),
          )
        : undefined,
    );
    await findText('ORD-1002');

    await user.selectOptions(screen.getByLabelText('Order state'), 'Failed');

    expect(await findText('1 order · Page 1 of 1')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?state=Failed');
    expect(orderListCalls(fetcher).at(-1)).toContain('state=Failed');
  });

  it('pages through results', async () => {
    const user = userEvent.setup();
    const { fetcher } = mount('/merchant/orders?pageSize=20', (url) =>
      url.includes('/v1/merchant/orders?')
        ? json(
            url.includes('page=2')
              ? page([acceptedOrder], 21, 2)
              : page([createdOrder], 21, 1),
          )
        : undefined,
    );
    expect(await findText('21 orders · Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await findText('21 orders · Page 2 of 2')).toBeInTheDocument();
    expect(orderListCalls(fetcher).at(-1)).toContain('page=2');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('ignores unknown URL filters instead of sending them', async () => {
    const { fetcher } = mount(
      '/merchant/orders?state=Bogus&pageSize=7&page=-3',
      (url) =>
        url.includes('/v1/merchant/orders?')
          ? json(page([createdOrder]))
          : undefined,
    );
    await findText('ORD-1002');

    expect(orderListCalls(fetcher)[0]).toMatch(/\?page=1&pageSize=20$/);
  });

  it('shows a clear notice instead of orders for an unapproved business', async () => {
    const { fetcher } = mount('/merchant/orders', undefined, {
      ...approvedBusiness,
      status: 'Suspended',
    });

    expect(await findText('Business approval required')).toBeInTheDocument();
    expect(screen.getByText(/currently Suspended/)).toBeInTheDocument();
    expect(orderListCalls(fetcher)).toHaveLength(0);
  });

  it('asks a merchant without a business to register first', async () => {
    mount('/merchant/orders', undefined, null);

    expect(await findText('Register your business first')).toBeInTheDocument();
  });

  it('shows a retryable error when orders cannot be loaded', async () => {
    mount('/merchant/orders', (url) =>
      url.includes('/v1/merchant/orders?')
        ? new Response('down', { status: 503 })
        : undefined,
    );

    expect(await findText('Unable to load orders')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });
});

describe('Merchant order detail', () => {
  it('shows a created order with its parcel and freshness', async () => {
    mount(`/merchant/orders/${createdOrder.id}`, (url) =>
      url.endsWith(`/v1/merchant/orders/${createdOrder.id}`)
        ? json(createdOrder)
        : undefined,
    );

    expect(await findText('ORD-1002')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SD-FICTION-01' })).toHaveAttribute(
      'href',
      '/track?code=SD-FICTION-01',
    );
    expect(screen.getByText('In transit')).toBeInTheDocument();
    expect(screen.getByText(/may be up to 5 minutes old/)).toBeInTheDocument();
    expect(screen.getByText('2026-11-13 10:20 UTC')).toBeInTheDocument();
    const progress = screen.getByRole('list', { name: 'Order progress' });
    expect(
      within(progress).getByText('1 unsuccessful attempt'),
    ).toBeInTheDocument();
    expect(within(progress).getByText('Parcel created')).toBeInTheDocument();
  });

  it('explains why an order failed', async () => {
    mount(`/merchant/orders/${failedOrder.id}`, (url) =>
      url.endsWith(`/v1/merchant/orders/${failedOrder.id}`)
        ? json(failedOrder)
        : undefined,
    );

    expect(await findText('Why it failed')).toBeInTheDocument();
    const notice = screen.getByRole('alert');
    expect(
      within(notice).getByText(/accepted price version no longer matches/),
    ).toBeInTheDocument();
    expect(
      within(notice).getByText(/code: pricing_changed/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No parcel was created for this order.'),
    ).toBeInTheDocument();
  });

  it('shows that an in-progress order is being re-checked', async () => {
    mount(`/merchant/orders/${retryingOrder.id}`, (url) =>
      url.endsWith(`/v1/merchant/orders/${retryingOrder.id}`)
        ? json(retryingOrder)
        : undefined,
    );

    expect(
      await findText(/Checking for updates every 15 seconds/),
    ).toBeInTheDocument();
    expect(screen.getByText('Latest problem')).toBeInTheDocument();
    expect(screen.getAllByText(/2026-11-13 09:01 UTC/).length).toBeGreaterThan(
      0,
    );
  });

  it('shows not found for a missing or foreign order', async () => {
    mount(`/merchant/orders/${createdOrder.id}`, (url) =>
      url.endsWith(`/v1/merchant/orders/${createdOrder.id}`)
        ? json({ code: 'order_not_found' }, 404)
        : undefined,
    );

    expect(await findText('Order not found')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('treats a malformed id as not found without calling the order API', async () => {
    const { fetcher } = mount('/merchant/orders/not-a-uuid');

    expect(await findText('Order not found')).toBeInTheDocument();
    expect(
      requestedUrls(fetcher).some((url) =>
        url.includes('/v1/merchant/orders/'),
      ),
    ).toBe(false);
  });
});
