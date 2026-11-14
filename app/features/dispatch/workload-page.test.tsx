import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { IdentityApi } from '~/features/identity/api';
import type { Profile } from '~/features/identity/contracts';
import { IdentityProvider, IdentitySession } from '~/features/identity/session';
import { customer, csrf, json, pair } from '~/features/identity/test-fixtures';
import { CourierWorkloadPage } from './workload-page';

const matchMedia = window.matchMedia.bind(window);
beforeEach(() => vi.stubGlobal('matchMedia', matchMedia));
afterEach(() => vi.unstubAllGlobals());
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const dispatcher: Profile = { ...customer, roles: ['Dispatcher'] };
const couriers = Array.from({ length: 21 }, (_, i) => ({
  courierId: id(i + 10),
  active: i !== 0,
  onDuty: i > 1,
  activeCount: i === 1 ? 0 : 21,
  capacity: 20,
  zoneIds: i === 1 ? [] : [id(99)],
}));
const assignments = Array.from({ length: 21 }, (_, i) => ({
  parcelId: id(i + 100),
  trackingNumber: `WORK-${i + 1}`,
  status: 'Assigned',
  serviceDate: i === 0 ? '2026-10-01' : '2026-12-01',
  assignedAt: '2026-11-14T12:00:00+00:00',
}));
const fleetPage = (params: URLSearchParams, count = couriers.length) => {
  const page = Number(params.get('page'));
  return json({
    items: couriers.slice(0, count).slice((page - 1) * 20, page * 20),
    totalCount: count,
    page,
    pageSize: 20,
  });
};
const assignmentPage = (
  courierId: string,
  params: URLSearchParams,
  count = assignments.length,
) => {
  const page = Number(params.get('page'));
  return json({
    courierId,
    items: assignments.slice(0, count).slice((page - 1) * 20, page * 20),
    totalCount: count,
    page,
    pageSize: 20,
  });
};

function mount(
  options: {
    account?: Profile | null;
    fleet?: (
      params: URLSearchParams,
      init?: RequestInit,
    ) => Response | Promise<Response>;
    assignments?: (
      courierId: string,
      params: URLSearchParams,
      init?: RequestInit,
    ) => Response | Promise<Response>;
    zones?: () => Response | Promise<Response>;
  } = {},
) {
  let account = options.account === undefined ? dispatcher : options.account;
  const fleet = vi.fn<
    (
      params: URLSearchParams,
      init?: RequestInit,
    ) => Response | Promise<Response>
  >(options.fleet ?? ((params) => fleetPage(params)));
  const parcels = vi.fn<
    (
      courierId: string,
      params: URLSearchParams,
      init?: RequestInit,
    ) => Response | Promise<Response>
  >(options.assignments ?? ((id, params) => assignmentPage(id, params)));
  const zones = vi.fn(
    options.zones ??
      (() =>
        json({
          zones: [
            { zoneId: id(99), name: 'Colombo', total: 0, statusCounts: {} },
          ],
        })),
  );
  const fetcher = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      'http://localhost',
    );
    if (url.pathname.endsWith('/auth/csrf')) return Promise.resolve(json(csrf));
    if (url.pathname.endsWith('/auth/logout'))
      return Promise.resolve(new Response(null, { status: 204 }));
    if (
      url.pathname.endsWith('/auth/refresh') ||
      url.pathname.endsWith('/auth/login')
    )
      return Promise.resolve(
        account
          ? json(pair(account, account.id))
          : json({ code: 'invalid_credentials' }, 401),
      );
    if (url.pathname === '/api/v1/couriers/workload')
      return Promise.resolve(fleet(url.searchParams, init));
    if (url.pathname === '/api/v1/zones/summary')
      return Promise.resolve(zones());
    const match = /^\/api\/v1\/couriers\/([^/]+)\/assignments$/.exec(
      url.pathname,
    );
    if (match)
      return Promise.resolve(parcels(match[1]!, url.searchParams, init));
    return Promise.resolve(json({ code: 'not_found' }, 404));
  });
  vi.stubGlobal('fetch', fetcher);
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = new IdentitySession(new IdentityApi(fetcher), () =>
    queries.clear(),
  );
  const router = createMemoryRouter(
    [
      { path: '/dispatch/workload', element: <CourierWorkloadPage /> },
      { path: '/dispatch/parcels/:id', element: <h1>Parcel details</h1> },
      { path: '/401', element: <h1>401</h1> },
      { path: '/403', element: <h1>403</h1> },
    ],
    { initialEntries: ['/dispatch/workload'] },
  );
  render(
    <QueryClientProvider client={queries}>
      <IdentityProvider session={session}>
        <RouterProvider router={router} />
      </IdentityProvider>
    </QueryClientProvider>,
  );
  return {
    fleet,
    parcels,
    zones,
    session,
    queries,
    router,
    user: userEvent.setup(),
    setAccount(value: Profile | null) {
      account = value;
    },
  };
}

async function loaded() {
  return screen.findByRole('button', {
    name: `View active parcels for ${id(10)}`,
  });
}
async function openAssignments(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await loaded());
  const dialog = await screen.findByRole('dialog', { name: 'Active parcels' });
  await within(dialog).findByRole('link', { name: 'View details for WORK-1' });
  return dialog;
}

describe('Dispatcher workload', () => {
  it('shows real inactive/off-duty/zero and over-capacity rows without claiming availability', async () => {
    const view = mount();
    await loaded();
    expect(await screen.findAllByText('Colombo')).toHaveLength(19);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getAllByText('Off duty')).toHaveLength(2);
    expect(screen.getByText('No zones')).toBeInTheDocument();
    expect(screen.getByText('0', { selector: 'td' })).toBeInTheDocument();
    expect(
      screen.getByText(/overdue and future service dates/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
    expect(view.fleet.mock.calls[0]![0].toString()).toBe('page=1&pageSize=20');
    expect(view.parcels).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole('link', { name: 'Courier workload' })[0],
    ).toHaveAttribute('aria-current', 'page');
  });

  it.each(['Customer', 'Courier', 'Merchant'] as const)(
    'denies %s before any private queries',
    async (role) => {
      const view = mount({ account: { ...customer, roles: [role] } });
      await screen.findByRole('heading', { name: '403' });
      expect(view.fleet).not.toHaveBeenCalled();
      expect(view.parcels).not.toHaveBeenCalled();
      expect(view.zones).not.toHaveBeenCalled();
    },
  );

  it('allows Admin through the existing operations policy', async () => {
    mount({ account: { ...customer, roles: ['Admin'] } });
    await loaded();
  });

  it('returns signed-out visitors to the workload route after sign-in', async () => {
    const view = mount({ account: null });
    await screen.findByRole('heading', { name: '401' });
    expect(view.router.state.location.state).toEqual({
      returnTo: '/dispatch/workload',
    });
    expect(view.fleet).not.toHaveBeenCalled();
  });

  it('pages couriers and corrects a page after the result shrinks', async () => {
    let count = 21;
    const view = mount({ fleet: (params) => fleetPage(params, count) });
    await loaded();
    const pagination = within(
      screen.getByRole('navigation', { name: 'Courier pages' }),
    );
    await view.user.click(pagination.getByRole('button', { name: 'Next' }));
    await screen.findByRole('button', {
      name: `View active parcels for ${id(30)}`,
    });
    count = 1;
    await view.user.click(screen.getByRole('button', { name: 'Refresh' }));
    await loaded();
    expect(view.fleet.mock.calls.at(-1)![0].get('page')).toBe('1');
    expect(
      await screen.findByText('Page 1 of 1 · 1 couriers'),
    ).toBeInTheDocument();
  });

  it('opens a paginated parcel dialog with details, service dates and focus restoration', async () => {
    const view = mount();
    const trigger = await loaded();
    const dialog = await openAssignments(view.user);
    expect(within(dialog).getByText('2026-10-01')).toBeInTheDocument();
    expect(within(dialog).getAllByText('2026-12-01')).toHaveLength(19);
    expect(
      within(dialog).getByRole('link', { name: 'View details for WORK-1' }),
    ).toHaveAttribute('href', `/dispatch/parcels/${id(100)}`);
    await view.user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await within(dialog).findByRole('link', {
      name: 'View details for WORK-21',
    });
    await view.user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    await view.user.click(trigger);
    await within(await screen.findByRole('dialog')).findByRole('link', {
      name: 'View details for WORK-1',
    });
    expect(view.parcels.mock.calls.at(-1)![1].get('page')).toBe('1');
  });

  it('shows assignments empty separately from no courier profiles', async () => {
    const view = mount({
      assignments: (id, params) => assignmentPage(id, params, 0),
    });
    await view.user.click(await loaded());
    await screen.findByText('No active assignments');
    expect(screen.queryByText('No courier profiles')).not.toBeInTheDocument();
  });

  it('distinguishes an empty fleet from a failed request', async () => {
    mount({ fleet: (params) => fleetPage(params, 0) });
    await screen.findByText('No courier profiles');
    expect(
      screen.queryByText('Unable to load courier workload'),
    ).not.toBeInTheDocument();
  });

  it('retries an initial failure without inventing a successful zero', async () => {
    let fail = true;
    const view = mount({
      fleet: (params) =>
        fail ? json({ code: 'delivery_unavailable' }, 503) : fleetPage(params),
    });
    await screen.findByText('Unable to load courier workload');
    expect(screen.queryByText('No courier profiles')).not.toBeInTheDocument();
    fail = false;
    await view.user.click(screen.getByRole('button', { name: 'Try again' }));
    await loaded();
  });

  it('retains workload on refresh failure and restores it on retry', async () => {
    let fail = false;
    const view = mount({
      fleet: (params) => (fail ? json({}, 503) : fleetPage(params)),
    });
    await loaded();
    fail = true;
    await view.user.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText(/Showing previously loaded workload/);
    expect(await loaded()).toBeInTheDocument();
    fail = false;
    await view.user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Unable to load courier workload'),
      ).not.toBeInTheDocument(),
    );
  });

  it('keeps workload usable with zone IDs when the catalog fails', async () => {
    let fail = true;
    const view = mount({
      zones: () =>
        fail
          ? json({}, 503)
          : json({
              zones: [
                {
                  zoneId: id(99),
                  name: 'Recovered zone',
                  total: 0,
                  statusCounts: {},
                },
              ],
            }),
    });
    await loaded();
    await screen.findByText('Zone names unavailable');
    expect(screen.getAllByText(id(99))).toHaveLength(19);
    fail = false;
    await view.user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findAllByText('Recovered zone');
  });

  it('retains assignment rows on refresh failure and refreshes workload too', async () => {
    let fail = false;
    const view = mount({
      assignments: (id, params) =>
        fail ? json({}, 503) : assignmentPage(id, params),
    });
    const dialog = await openAssignments(view.user);
    fail = true;
    await view.user.click(
      within(dialog).getByRole('button', { name: 'Refresh assignments' }),
    );
    await within(dialog).findByText(/Showing previously loaded assignments/);
    expect(
      within(dialog).getByRole('link', { name: 'View details for WORK-1' }),
    ).toBeInTheDocument();
    expect(view.fleet.mock.calls.length).toBeGreaterThan(1);
  });

  it('handles missing couriers without presenting an empty success', async () => {
    const view = mount({ assignments: () => json({ code: 'not_found' }, 404) });
    await view.user.click(await loaded());
    await screen.findByText('Courier not found');
    expect(screen.queryByText('No active assignments')).not.toBeInTheDocument();
  });

  it('corrects assignment pagination when completions shrink the last page', async () => {
    let count = 21;
    const view = mount({
      assignments: (id, params) => assignmentPage(id, params, count),
    });
    const dialog = await openAssignments(view.user);
    await view.user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await within(dialog).findByRole('link', {
      name: 'View details for WORK-21',
    });
    count = 1;
    await view.user.click(
      within(dialog).getByRole('button', { name: 'Refresh assignments' }),
    );
    await within(dialog).findByRole('link', {
      name: 'View details for WORK-1',
    });
    expect(view.parcels.mock.calls.at(-1)![1].get('page')).toBe('1');
  });

  it('clears open selection and private cache on account changes', async () => {
    const view = mount();
    await openAssignments(view.user);
    const next: Profile = { ...dispatcher, id: id(700) };
    await act(async () => {
      await view.session.logout();
      view.setAccount(next);
      await view.session.login('next@example.test', 'example-password');
      await view.router.navigate('/dispatch/workload');
    });
    await loaded();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      view.queries
        .getQueryCache()
        .getAll()
        .every((query) => !query.queryKey.includes(dispatcher.id)),
    ).toBe(true);
  });

  it('aborts an in-flight assignment read and never shows its late result to another account', async () => {
    let resolve: (response: Response) => void = () => {};
    let signal: AbortSignal | null | undefined;
    const view = mount({
      assignments: (_id, _params, init) => {
        signal = init?.signal;
        return new Promise<Response>((done) => {
          resolve = done;
        });
      },
    });
    await view.user.click(await loaded());
    await screen.findByRole('status', { name: '' });
    await waitFor(() => expect(view.parcels).toHaveBeenCalledTimes(1));
    const next: Profile = { ...dispatcher, id: id(701) };
    await act(async () => {
      await view.session.logout();
      view.setAccount(next);
      await view.session.login('next@example.test', 'example-password');
      await view.router.navigate('/dispatch/workload');
    });
    await loaded();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolve(assignmentPage(id(10), new URLSearchParams('page=1')));
      await Promise.resolve();
    });
    expect(screen.queryByText('WORK-1')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
