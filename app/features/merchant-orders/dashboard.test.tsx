import { afterEach, describe, expect, it, vi } from 'vitest';
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
import { dashboard } from './test-fixtures';

const isDashboard = (url: string) => url.includes('/v1/merchants/me/dashboard');
const dashboardCalls = (fetcher: Fetcher) =>
  requestedUrls(fetcher).filter(isDashboard);
const answer =
  (body: object = dashboard) =>
  (url: string) =>
    isDashboard(url) ? json(body) : undefined;

const NOVEMBER = '/merchant/overview?from=2026-11-01&to=2026-11-13';

afterEach(() => {
  vi.useRealTimers();
});

describe('Merchant business overview', () => {
  it('shows order counts, delivery results and rates for the chosen period', async () => {
    const { fetcher } = mount(NOVEMBER, answer());

    expect(await findText('42')).toBeInTheDocument();
    const orders = screen.getByRole('region', {
      name: 'Orders received in this period',
    });
    expect(
      within(orders).getByText('Being processed').nextSibling,
    ).toHaveTextContent('3');
    expect(
      within(orders).getByText('Active parcels').nextSibling,
    ).toHaveTextContent('20');
    const outcomes = screen.getByRole('region', {
      name: 'Deliveries finished in this period',
    });
    expect(within(outcomes).getByText('88.2%')).toBeInTheDocument();
    expect(
      within(outcomes).getByText('Failure rate 11.8%'),
    ).toBeInTheDocument();
    expect(
      within(outcomes).getByText('Not counted in the rates'),
    ).toBeInTheDocument();

    // The UI's inclusive end day becomes the API's exclusive next midnight.
    expect(dashboardCalls(fetcher)[0]).toContain(
      'from=2026-11-01T00%3A00%3A00Z&to=2026-11-14T00%3A00%3A00Z',
    );
  });

  it('breaks parcels down by status as readable rows', async () => {
    mount(NOVEMBER, answer());

    const breakdown = await screen.findByRole(
      'list',
      { name: 'Parcels by status' },
      { timeout: 5_000 },
    );
    const rows = within(breakdown).getAllByRole('listitem');
    expect(rows).toHaveLength(8);
    expect(rows[5]).toHaveTextContent('Delivered15 parcels');
    expect(rows[5]).toHaveAttribute('title', 'Delivered: 15 (39%)');
  });

  it('lists recent orders with links to their details', async () => {
    mount(NOVEMBER, answer());

    const recent = await screen.findByRole(
      'list',
      { name: 'Recent orders' },
      { timeout: 5_000 },
    );
    expect(
      within(recent).getByRole('link', { name: 'ORD-1002' }),
    ).toHaveAttribute(
      'href',
      '/merchant/orders/22222222-2222-4222-8222-222222222222',
    );
    expect(
      within(recent).getByRole('link', { name: 'SD-FICTION-01' }),
    ).toHaveAttribute('href', '/track?code=SD-FICTION-01');
  });

  it('defaults to today in UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T09:45:00Z'));
    const { fetcher } = mount('/merchant/overview', answer());

    await findText('42');

    expect(dashboardCalls(fetcher)[0]).toContain(
      'from=2026-11-13T00%3A00%3A00Z&to=2026-11-14T00%3A00%3A00Z',
    );
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('switches to a preset and keeps it in the URL', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T09:45:00Z'));
    const user = userEvent.setup();
    const { fetcher, router } = mount('/merchant/overview', answer());
    await findText('42');

    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));

    expect(router.state.location.search).toBe('?from=2026-11-07&to=2026-11-13');
    await vi.waitFor(() =>
      expect(dashboardCalls(fetcher).at(-1)).toContain(
        'from=2026-11-07T00%3A00%3A00Z',
      ),
    );
  });

  it('rejects an end date before the start date without asking the server', async () => {
    const user = userEvent.setup();
    const { fetcher } = mount(NOVEMBER, answer());
    await findText('42');
    const callsBefore = dashboardCalls(fetcher).length;

    await user.clear(screen.getByLabelText('To'));
    await user.type(screen.getByLabelText('To'), '2026-10-01');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'on or after the start date',
    );
    expect(dashboardCalls(fetcher)).toHaveLength(callsBefore);
  });

  it('shows no rate when nothing finished in the period', async () => {
    mount(
      NOVEMBER,
      answer({
        ...dashboard,
        terminalDeliveredCount: 0,
        terminalFailedCount: 0,
        successRate: 0,
        failureRate: 0,
      }),
    );

    expect(
      await findText('No deliveries finished in this period'),
    ).toBeInTheDocument();
    expect(screen.getByText('Success rate').nextSibling).toHaveTextContent('—');
  });

  it('labels parcel data that was already old when loaded', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T09:45:00Z'));
    mount(
      NOVEMBER,
      answer({ ...dashboard, lastRefreshedAt: '2026-11-13T08:00:00+00:00' }),
    );

    expect(
      await findText(/last refreshed 2026-11-13 08:00 UTC/),
    ).toBeInTheDocument();
    expect(screen.getByText('They may be out of date.')).toBeInTheDocument();
  });

  it('does not label recent parcel data as stale', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T09:45:00Z'));
    mount(NOVEMBER, answer());

    await findText(/last refreshed 2026-11-13 09:40 UTC/);
    expect(
      screen.queryByText('They may be out of date.'),
    ).not.toBeInTheDocument();
  });

  it('explains an empty period', async () => {
    mount(
      NOVEMBER,
      answer({
        ...dashboard,
        totalOrders: 0,
        pendingCount: 0,
        failedJobs: 0,
        activeCount: 0,
        statusCounts: {},
        recentOrders: [],
        lastRefreshedAt: null,
      }),
    );

    expect(
      await findText('No parcels were created for orders in this period.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No orders were received in this period.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No parcel statuses have been received yet/),
    ).toBeInTheDocument();
  });

  it('shows a clear notice instead of figures for an unapproved business', async () => {
    const { fetcher } = mount(NOVEMBER, answer(), {
      ...approvedBusiness,
      status: 'Pending',
    });

    expect(await findText(/view business statistics/)).toBeInTheDocument();
    expect(dashboardCalls(fetcher)).toHaveLength(0);
  });

  it('offers a retry when the overview cannot be loaded', async () => {
    mount(NOVEMBER, (url) =>
      isDashboard(url) ? new Response('down', { status: 503 }) : undefined,
    );

    expect(
      await findText('Unable to load the business overview'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });
});
