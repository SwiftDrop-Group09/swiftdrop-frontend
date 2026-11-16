import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdentityApi } from '~/features/identity/api';
import { IdentityShell } from '~/features/identity/components';
import type { Profile } from '~/features/identity/contracts';
import { IdentityProvider, IdentitySession } from '~/features/identity/session';
import { csrf, customer, json, pair } from '~/features/identity/test-fixtures';
import type { ZoneSummaryResponse } from '~/features/admin-delivery/contracts';
import type { CustomerParcelPage } from '~/features/customer-tracking/contracts';
import DashboardRoute from '~/portals/customer/dashboard';
import { createAppQueryClient } from '~/shared/query-client';
import DispatcherDashboard from './dashboard';
import { dispatchSnapshot } from './dashboard-analytics';

const matchMedia = window.matchMedia.bind(window);
beforeEach(() => vi.stubGlobal('matchMedia', matchMedia));
afterEach(() => vi.unstubAllGlobals());
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const dispatcher: Profile = { ...customer, roles: ['Dispatcher'] };
const zones: ZoneSummaryResponse['zones'] = [
  {
    zoneId: id(10),
    name: 'Colombo',
    total: 999,
    statusCounts: {
      Created: 7,
      Assigned: 2,
      PickedUp: 3,
      InTransit: 4,
      OutForDelivery: 5,
      Delivered: 100,
      Failed: 20,
      Cancelled: 10,
      Returned: 6,
    },
  },
  { zoneId: id(11), name: 'Kandy', total: 3, statusCounts: { Created: 3 } },
  { zoneId: id(12), name: 'Empty zone', total: 0, statusCounts: {} },
];
const parcels: CustomerParcelPage = {
  totalCount: 42,
  page: 1,
  pageSize: 5,
  items: Array.from({ length: 5 }, (_, n) => ({
    id: id(100 + n),
    trackingNumber: `DASH-${n + 1}`,
    status: 'Created',
    version: 1,
    priceSnapshot: { total: 500, currency: 'LKR', pricingVersion: 'v1' },
    createdAt: '2026-11-16T08:00:00Z',
    updatedAt: '2026-11-16T08:00:00Z',
    pickupCity: 'Colombo',
    deliveryCity: 'Kandy',
    recipientName: 'Fixture recipient',
    packageDetails: { size: 'Small', weightKg: 1 },
    hasProof: false,
  })),
};
const fleet = Array.from({ length: 20 }, (_, n) => ({
  courierId: id(200 + n),
  courierCode: `COU-${String(n + 1).padStart(4, '0')}`,
  active: n !== 1,
  onDuty: n !== 2,
  activeCount: n + 1,
  capacity: 5,
  zoneIds: [id(10)],
}));
type Override = (
  url: URL,
  init?: RequestInit,
) => Response | Promise<Response> | undefined;

function mount(
  override?: Override,
  profile: Profile | null = dispatcher,
  direct = false,
) {
  let account = profile;
  const reads = vi.fn<(url: URL, init?: RequestInit) => void>();
  const transport = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      'http://localhost',
    );
    if (url.pathname.endsWith('/auth/csrf')) return Promise.resolve(json(csrf));
    if (url.pathname.endsWith('/auth/refresh'))
      return Promise.resolve(
        account
          ? json(pair(account))
          : json({ code: 'invalid_credentials' }, 401),
      );
    reads(url, init);
    const replacement = override?.(url, init);
    if (replacement) return Promise.resolve(replacement);
    if (url.pathname.endsWith('/zones/summary'))
      return Promise.resolve(json({ zones }));
    if (url.pathname.endsWith('/parcels'))
      return Promise.resolve(json(parcels));
    if (url.pathname.endsWith('/couriers/workload'))
      return Promise.resolve(
        json({ items: fleet, totalCount: 37, page: 1, pageSize: 20 }),
      );
    if (url.pathname.endsWith('/users/courier-directory'))
      return Promise.resolve(
        json(
          (url.searchParams.get('ids') ?? '')
            .split(',')
            .map((courierId, n) => ({
              id: courierId,
              fullName: `Courier ${n + 1}`,
            })),
        ),
      );
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  });
  vi.stubGlobal('fetch', transport);
  const queries = createAppQueryClient();
  const session = new IdentitySession(new IdentityApi(transport), () =>
    queries.clear(),
  );
  const router = createMemoryRouter(
    [
      {
        path: '/dashboard',
        element: direct ? (
          <IdentityShell>
            <DispatcherDashboard />
          </IdentityShell>
        ) : (
          <DashboardRoute />
        ),
      },
      {
        path: '/dispatch/unassigned',
        element: <h1>Unassigned destination</h1>,
      },
      { path: '/dispatch/workload', element: <h1>Workload destination</h1> },
      { path: '/dispatch/zones', element: <h1>Zones destination</h1> },
      { path: '/dispatch/parcels/:id', element: <h1>Parcel destination</h1> },
      { path: '/away', element: <h1>Away</h1> },
      { path: '/401', element: <h1>401</h1> },
      { path: '/403', element: <h1>403</h1> },
    ],
    { initialEntries: ['/dashboard'] },
  );
  render(
    <QueryClientProvider client={queries}>
      <IdentityProvider session={session}>
        <RouterProvider router={router} />
      </IdentityProvider>
    </QueryClientProvider>,
  );
  return {
    reads,
    queries,
    session,
    router,
    user: userEvent.setup(),
    setAccount: (next: Profile) => {
      account = next;
    },
  };
}
async function loaded() {
  await screen.findByText('Courier 1');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled(),
  );
}

describe('Dispatcher operations dashboard', () => {
  it('uses authoritative queue totals, current states and bounded previews inside the existing shell', async () => {
    const view = mount();
    await loaded();
    for (const [label, value] of [
      ['Awaiting assignment', '42'],
      ['In progress', '14'],
      ['Out for delivery', '5'],
      ['Zones with backlog', '2'],
    ]) {
      expect(
        within(screen.getByLabelText(label!)).getByText(value!, {
          exact: true,
        }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByText('5 of 42 unassigned parcels shown · All booking dates.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '5 of 37 courier profiles shown · Preview of the first workload page.',
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('list', { name: 'Courier workload preview' }),
      ).getAllByRole('listitem'),
    ).toHaveLength(5);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Off duty')).toBeInTheDocument();
    expect(screen.queryByText('COU-0006')).not.toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Dispatch navigation' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reporting period' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Assign courier/ }),
    ).not.toBeInTheDocument();
    const urls = view.reads.mock.calls.map(([url]) => url);
    expect(
      urls
        .find((url) => url.pathname.endsWith('/parcels'))
        ?.searchParams.toString(),
    ).toBe('status=Created&page=1&pageSize=5');
    expect(
      urls.find((url) => url.pathname.endsWith('/zones/summary'))?.search,
    ).toBe('');
    expect(
      urls.find((url) => url.pathname.endsWith('/couriers/workload'))?.search,
    ).toBe('?page=1&pageSize=20');
    expect(
      urls
        .find((url) => url.pathname.endsWith('/courier-directory'))
        ?.searchParams.get('ids')
        ?.split(','),
    ).toHaveLength(5);
    expect(
      urls.some((url) =>
        /merchants|reports|parcels\/summary|parcels\/me/.test(url.pathname),
      ),
    ).toBe(false);
  });

  it.each([
    ['Open unassigned queue', '/dispatch/unassigned', 'Unassigned destination'],
    ['View workload', '/dispatch/workload', 'Workload destination'],
    ['View zones', '/dispatch/zones', 'Zones destination'],
    [
      'View details for DASH-1',
      `/dispatch/parcels/${id(100)}`,
      'Parcel destination',
    ],
  ])('navigates %s through the SPA', async (name, path, heading) => {
    const { user, router } = mount();
    await loaded();
    await user.click(screen.getByRole('link', { name }));
    await screen.findByRole('heading', { name: heading });
    expect(router.state.location.pathname).toBe(path);
  });

  it('separates no catalog, no fleet and an empty queue from unavailable data', async () => {
    const view = mount((url) => {
      if (url.pathname.endsWith('/zones/summary')) return json({ zones: [] });
      if (url.pathname.endsWith('/parcels'))
        return json({ ...parcels, items: [], totalCount: 0 });
      if (url.pathname.endsWith('/workload'))
        return json({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    });
    await screen.findByText('No delivery zones configured');
    await screen.findByText('No courier profiles');
    await screen.findByText('No parcels awaiting assignment');
    expect(
      within(screen.getByLabelText('In progress')).getByText('0'),
    ).toBeInTheDocument();
    expect(
      view.reads.mock.calls.some(([url]) =>
        url.pathname.endsWith('/courier-directory'),
      ),
    ).toBe(false);
  });

  it('shows a configured zero-workload state', async () => {
    mount((url) =>
      url.pathname.endsWith('/zones/summary')
        ? json({ zones: [zones[2]] })
        : undefined,
    );
    await screen.findByText('No parcels in configured zones');
    expect(
      screen.queryByText('No delivery zones configured'),
    ).not.toBeInTheDocument();
  });

  it.each(['Delivered', 'Failed', 'Cancelled', 'Returned'])(
    'includes zones containing only %s parcels instead of hiding them as inactive',
    async (status) => {
      mount((url) =>
        url.pathname.endsWith('/zones/summary')
          ? json({
              zones: [{ ...zones[0], total: 4, statusCounts: { [status]: 4 } }],
            })
          : undefined,
      );
      const table = await screen.findByRole('table', {
        name: 'Zone workload chart values',
      });
      expect(
        within(table).getByRole('rowheader', { name: 'Colombo' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: 'Current zone workload chart' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('No parcels in configured zones'),
      ).not.toBeInTheDocument();
    },
  );

  it('distinguishes an unavailable status breakdown from an empty zone', async () => {
    mount((url) =>
      url.pathname.endsWith('/zones/summary')
        ? json({ zones: [{ ...zones[0], statusCounts: {} }] })
        : undefined,
    );
    await screen.findByText('No status breakdown available');
    expect(
      screen.queryByText('No parcels in configured zones'),
    ).not.toBeInTheDocument();
  });

  it('keeps independent reads useful on initial failure and never substitutes zero', async () => {
    const view = mount((url) =>
      url.pathname.endsWith('/zones/summary')
        ? json({ code: 'unavailable' }, 503)
        : undefined,
    );
    await loaded();
    expect(
      screen.getByText('Unable to load zone workload'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('In progress')).getByText('—'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Awaiting assignment')).getByText('42'),
    ).toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(
        view.reads.mock.calls.filter(([url]) =>
          url.pathname.endsWith('/zones/summary'),
        ),
      ).toHaveLength(2),
    );
    expect(
      view.reads.mock.calls.every(
        ([, init]) => !init?.method || init.method === 'GET',
      ),
    ).toBe(true);
  });

  it('keeps snapshot KPIs usable when the queue fails without inventing a backlog total', async () => {
    mount((url) =>
      url.pathname.endsWith('/parcels')
        ? json({ code: 'unavailable' }, 503)
        : undefined,
    );
    await loaded();
    expect(
      screen.getByText('Unable to load unassigned parcels'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Awaiting assignment')).getByText('—'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('In progress')).getByText('14'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No parcels awaiting assignment'),
    ).not.toBeInTheDocument();
  });

  it('retains stale values on refresh failure, then recovers all sections', async () => {
    let fail = false;
    let empty = false;
    const view = mount((url) => {
      if (fail) return json({ code: 'unavailable' }, 503);
      if (empty && url.pathname.endsWith('/parcels'))
        return json({ ...parcels, items: [], totalCount: 0 });
    });
    await loaded();
    fail = true;
    await view.user.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('Unable to refresh zone workload');
    await screen.findByText('Unable to refresh unassigned parcels');
    await screen.findByText('Unable to refresh courier workload');
    expect(screen.getByRole('link', { name: 'DASH-1' })).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('In progress')).getByText('14'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Previously loaded · Refresh failed'),
    ).toHaveLength(4);
    fail = false;
    empty = true;
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled(),
    );
    await view.user.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('No parcels awaiting assignment');
    await waitFor(() =>
      expect(
        screen.queryByText('Unable to refresh zone workload'),
      ).not.toBeInTheDocument(),
    );
    expect(
      within(screen.getByLabelText('Awaiting assignment')).getByText('0'),
    ).toBeInTheDocument();
  });

  it('uses codes when courier names fail or are missing, with safe retry', async () => {
    let fail = true;
    const { user } = mount((url) =>
      url.pathname.endsWith('/courier-directory')
        ? fail
          ? json({ code: 'unavailable' }, 503)
          : json([])
        : undefined,
    );
    await screen.findByText('Courier names unavailable');
    expect(screen.getByText('COU-0001')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Courier names unavailable'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText('COU-0001')).toBeInTheDocument();
  });

  it.each(['Customer', 'Courier', 'Merchant', 'Admin', null] as const)(
    'blocks direct feature mounting for %s before private reads',
    async (role) => {
      const { reads } = mount(
        undefined,
        role ? { ...customer, roles: [role] } : null,
        true,
      );
      await screen.findByRole('heading', { name: role ? '403' : '401' });
      expect(reads).not.toHaveBeenCalled();
    },
  );

  it('cancels an in-flight summary when leaving the dashboard', async () => {
    let signal: AbortSignal | null | undefined;
    const view = mount((url, init) => {
      if (url.pathname.endsWith('/zones/summary')) {
        signal = init?.signal;
        return new Promise<Response>((_resolve, reject) =>
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          ),
        );
      }
    });
    await screen.findByText('Loading zone workload…');
    await act(() => view.router.navigate('/away'));
    expect(signal?.aborted).toBe(true);
  });

  it('clears private caches and replaces values on account change', async () => {
    let changed = false;
    const view = mount((url) =>
      changed && url.pathname.endsWith('/parcels')
        ? json({ ...parcels, items: [], totalCount: 0 })
        : undefined,
    );
    await loaded();
    const next: Profile = { ...dispatcher, id: id(999) };
    changed = true;
    view.setAccount(next);
    await act(() => view.session.refresh());
    await screen.findByText('No parcels awaiting assignment');
    expect(
      view.queries.getQueryData(['delivery-zone-summary', dispatcher.id]),
    ).toBeUndefined();
    expect(
      view.queries.getQueryData(['delivery-zone-summary', next.id]),
    ).toBeDefined();
    expect(
      screen.queryByRole('link', { name: 'DASH-1' }),
    ).not.toBeInTheDocument();
  });

  it('unmounts Dispatcher reads and clears its cached results when the role changes', async () => {
    const view = mount();
    await loaded();
    const count = view.reads.mock.calls.length;
    act(() => view.session.updateUser({ ...dispatcher, roles: ['Merchant'] }));
    await screen.findByLabelText('Dashboard workspace');
    expect(screen.queryByLabelText('Dispatch KPIs')).not.toBeInTheDocument();
    expect(
      view.queries.getQueryData(['delivery-zone-summary', dispatcher.id]),
    ).toBeUndefined();
    expect(view.reads).toHaveBeenCalledTimes(count);
  });

  it('preserves operational KPIs while exposing all chart statuses and attention ordering', async () => {
    const extra = Array.from({ length: 6 }, (_, n) => ({
      zoneId: id(400 + n),
      name: `Zone ${n}`,
      total: 1,
      statusCounts: { Created: 1 },
    }));
    const snapshot = dispatchSnapshot([...zones, ...extra]);
    expect(snapshot.inProgress).toBe(14);
    expect(snapshot.outForDelivery).toBe(5);
    expect(snapshot.zonesWithBacklog).toBe(8);
    expect(
      dispatchSnapshot([
        { ...zones[1]!, name: 'Tie', zoneId: id(2) },
        { ...zones[1]!, name: 'Tie', zoneId: id(1) },
      ]).workloads.map((zone) => zone.zoneId),
    ).toEqual([id(1), id(2)]);
    mount((url) =>
      url.pathname.endsWith('/zones/summary')
        ? json({ zones: [...zones, ...extra] })
        : undefined,
    );
    const table = await screen.findByRole('table', {
      name: 'Zone workload chart values',
    });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    const row = within(table).getAllByRole('row')[1]!;
    expect(within(row).getByRole('rowheader')).toHaveTextContent('Colombo');
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['7', '2', '3', '4', '5', '100', '20', '10', '6', '999']);
    expect(
      screen.getByText(
        /6 of 9 zones · Ranked by Booked \+ Delivery unsuccessful \+ Cancelled/,
      ),
    ).toBeInTheDocument();
  });
});
