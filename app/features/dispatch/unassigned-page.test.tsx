import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { format } from 'date-fns';
import { IdentityApi } from '~/features/identity/api';
import type { Profile } from '~/features/identity/contracts';
import { IdentityProvider, IdentitySession } from '~/features/identity/session';
import { customer, csrf, json, pair } from '~/features/identity/test-fixtures';
import type { CustomerParcelListItem } from '~/features/customer-tracking/contracts';
import { UnassignedParcelsPage } from './unassigned-page';

const matchMedia = window.matchMedia.bind(window);
beforeEach(() => {
  vi.stubGlobal('matchMedia', matchMedia);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const dispatcher: Profile = { ...customer, roles: ['Dispatcher'] };
const deliveryZones = [
  {
    zoneId: '00000000-0000-4000-8000-000000000010',
    name: 'Colombo',
    total: 41,
    statusCounts: { Created: 41 },
  },
  {
    zoneId: '00000000-0000-4000-8000-000000000020',
    name: 'Kandy',
    total: 0,
    statusCounts: {},
  },
];
const parcels: CustomerParcelListItem[] = Array.from(
  { length: 41 },
  (_, index) => ({
    id: `parcel-${index + 1}`,
    trackingNumber: `TRK-${index + 1}`,
    status: 'Created',
    version: 1,
    priceSnapshot: { total: 500, currency: 'LKR', pricingVersion: 'v1' },
    createdAt: '2026-11-13T23:59:00Z',
    updatedAt: '2026-11-13T23:59:00Z',
    pickupCity: 'Colombo',
    deliveryCity: 'Kandy',
    recipientName: `Recipient ${index + 1}`,
    packageDetails: { size: 'Medium', weightKg: 3 },
    hasProof: false,
  }),
);

function parcelPage(params: URLSearchParams, count = parcels.length) {
  const page = Number(params.get('page'));
  const pageSize = Number(params.get('pageSize'));
  return json({
    items: parcels
      .slice(0, count)
      .slice((page - 1) * pageSize, page * pageSize),
    totalCount: count,
    page,
    pageSize,
  });
}

function mount(
  read: (
    params: URLSearchParams,
    init?: RequestInit,
  ) => Response | Promise<Response> = (params) => parcelPage(params),
  signedIn: Profile | null = dispatcher,
  readZones: () => Response | Promise<Response> = () =>
    json({ zones: deliveryZones }),
) {
  let account = signedIn;
  const reads = vi.fn(read);
  const zoneReads = vi.fn(readZones);
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
    if (
      url.pathname.endsWith('/auth/refresh') ||
      url.pathname.endsWith('/auth/login')
    )
      return Promise.resolve(
        account
          ? json(pair(account, account.id))
          : json({ code: 'invalid_credentials' }, 401),
      );
    if (url.pathname === '/api/v1/parcels')
      return Promise.resolve(reads(url.searchParams, init));
    if (url.pathname === '/api/v1/zones/summary')
      return Promise.resolve(zoneReads());
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
      { path: '/dispatch/unassigned', element: <UnassignedParcelsPage /> },
      { path: '/dispatch/parcels/:id', element: <h1>Parcel details</h1> },
      { path: '/401', element: <h1>401</h1> },
      { path: '/403', element: <h1>403</h1> },
    ],
    { initialEntries: ['/dispatch/unassigned'] },
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
    zoneReads,
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
  await screen.findByRole('link', { name: 'View details for TRK-1' });
}

async function chooseZone(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole('combobox', { name: 'Delivery zone' }));
  await user.click(screen.getByRole('option', { name }));
}

async function selectBookingDate(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  day: number,
  month = 10,
) {
  await user.click(screen.getByRole('button', { name: label }));
  const popover = screen.getByRole('dialog', { name: label });
  if (month === 9) {
    await user.click(
      within(popover).getByRole('button', { name: 'Go to the Previous Month' }),
    );
  }
  await user.click(
    within(popover).getByRole('button', {
      name: new RegExp(format(new Date(2026, month, day), 'PPPP')),
    }),
  );
  await user.keyboard('{Escape}');
}

describe('Dispatcher unassigned queue', () => {
  it.each(['Dispatcher', 'Admin'] as const)(
    'shows the shared shell and Created-only operational query for %s',
    async (role) => {
      const { reads, queries, user, router } = mount(
        (params) => parcelPage(params),
        {
          ...dispatcher,
          roles: [role],
        },
      );
      await loaded();
      expect(reads.mock.calls[0]![0].toString()).toBe(
        'status=Created&page=1&pageSize=20',
      );
      expect(
        queries
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ).toContainEqual([
        'customer-parcels',
        dispatcher.id,
        true,
        { status: 'Created', page: 1, pageSize: 20 },
      ]);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' });
      expect(breadcrumb).toHaveTextContent('Dashboard');
      expect(breadcrumb).toHaveTextContent('Dispatch');
      expect(breadcrumb).toHaveTextContent('Unassigned parcels');
      expect(
        within(
          screen.getByRole('navigation', { name: 'Dispatch navigation' }),
        ).getByRole('link', { name: 'Unassigned parcels' }),
      ).toHaveAttribute('aria-current', 'page');
      expect(screen.getByText('41 matching parcels')).toBeInTheDocument();
      expect(
        screen.getAllByRole('link', { name: /^View details for/ }),
      ).toHaveLength(20);
      expect(screen.getAllByText('Medium · 3 kg')).toHaveLength(20);
      await user.click(
        screen.getByRole('link', { name: 'View details for TRK-1' }),
      );
      expect(router.state.location.pathname).toBe('/dispatch/parcels/parcel-1');
    },
  );

  it.each(['Customer', 'Courier', 'Merchant', null] as const)(
    'blocks %s before private reads',
    async (role) => {
      const { reads, zoneReads } = mount(
        (params) => parcelPage(params),
        role ? { ...customer, roles: [role] } : null,
      );
      await screen.findByRole('heading', { name: role ? '403' : '401' });
      expect(reads).not.toHaveBeenCalled();
      expect(zoneReads).not.toHaveBeenCalled();
    },
  );

  it('applies trimmed search and inclusive UTC days only on submit, resets pages, and clears filters', async () => {
    const { reads, user } = mount();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');
    await user.type(
      screen.getByLabelText('Tracking number or recipient'),
      ' TRK-1 ',
    );
    await selectBookingDate(user, 'Booked from (UTC)', 13);
    await selectBookingDate(user, 'Booked through (UTC)', 13);
    await chooseZone(user, 'Colombo');
    expect(reads).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByText('Page 1 of 3');
    const params = reads.mock.calls.at(-1)![0];
    expect(Object.fromEntries(params)).toEqual({
      status: 'Created',
      zoneId: deliveryZones[0]!.zoneId,
      from: '2026-11-13T00:00:00.000Z',
      to: '2026-11-14T00:00:00.000Z',
      search: 'TRK-1',
      page: '1',
      pageSize: '20',
    });
    expect(
      screen.getByLabelText('Tracking number or recipient'),
    ).toHaveAttribute('maxlength', '128');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect(reads.mock.calls.at(-1)![0].toString()).toBe(
        'status=Created&page=1&pageSize=20',
      ),
    );
    expect(screen.getByLabelText('Tracking number or recipient')).toHaveValue(
      '',
    );
    expect(screen.getByLabelText('Booked from (UTC)')).toHaveTextContent(
      'Pick a date',
    );
    expect(screen.getByLabelText('Booked through (UTC)')).toHaveTextContent(
      'Pick a date',
    );
    expect(
      screen.getByRole('combobox', { name: 'Delivery zone' }),
    ).toHaveTextContent('All delivery zones');
  });

  it('keeps zone changes in the draft, filters an empty zone, and returns to page one', async () => {
    const { reads, user } = mount((params) =>
      parcelPage(params, params.has('zoneId') ? 0 : 41),
    );
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');
    await chooseZone(user, 'Kandy');
    expect(reads).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByText('No parcels match these filters');
    expect(reads.mock.calls.at(-1)![0].get('zoneId')).toBe(
      deliveryZones[1]!.zoneId,
    );
    expect(reads.mock.calls.at(-1)![0].get('page')).toBe('1');
  });

  it('keeps the queue usable while zones load or fail, and retries the catalog independently', async () => {
    let resolve!: (response: Response) => void;
    let attempts = 0;
    const { reads, user, zoneReads } = mount(undefined, dispatcher, () =>
      ++attempts === 1
        ? new Promise<Response>((done) => {
            resolve = done;
          })
        : json({ zones: deliveryZones }),
    );
    await loaded();
    expect(screen.getByText('Loading delivery zones…')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Delivery zone' }),
    ).toBeDisabled();
    await act(async () => {
      resolve(json({ code: 'delivery_unavailable' }, 503));
      await Promise.resolve();
    });
    await screen.findByText('Unable to load delivery zones');
    expect(
      screen.getByRole('link', { name: 'View details for TRK-1' }),
    ).toBeInTheDocument();
    const notice = screen
      .getByText('Unable to load delivery zones')
      .closest('[role="alert"]')!;
    await user.click(
      within(notice as HTMLElement).getByRole('button', { name: 'Try again' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Delivery zone' }),
      ).toBeEnabled(),
    );
    expect(zoneReads).toHaveBeenCalledTimes(2);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('shows a successful empty catalog separately from a failed catalog', async () => {
    mount(undefined, dispatcher, () => json({ zones: [] }));
    await loaded();
    expect(screen.getByText('No delivery zones available')).toBeInTheDocument();
    expect(
      screen.queryByText('Unable to load delivery zones'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Delivery zone' }),
    ).toBeDisabled();
  });

  it('refreshes parcels and zones together and retains cached options and the applied selection after a catalog failure', async () => {
    let attempts = 0;
    const { reads, user, zoneReads } = mount(undefined, dispatcher, () =>
      ++attempts === 2
        ? json({ code: 'delivery_unavailable' }, 503)
        : json({ zones: deliveryZones }),
    );
    await loaded();
    await chooseZone(user, 'Colombo');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('Unable to refresh delivery zones');
    expect(
      screen.getByRole('combobox', { name: 'Delivery zone' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('combobox', { name: 'Delivery zone' }),
    ).toHaveTextContent('Colombo');
    expect(zoneReads).toHaveBeenCalledTimes(2);
    expect(reads).toHaveBeenCalledTimes(3);
    expect(reads.mock.calls.at(-1)![0].get('zoneId')).toBe(
      deliveryZones[0]!.zoneId,
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Unable to refresh delivery zones'),
      ).not.toBeInTheDocument(),
    );
    expect(reads).toHaveBeenCalledTimes(3);
  });

  it('rejects reversed dates inline without changing the requested filters', async () => {
    const { reads, user } = mount();
    await loaded();
    await selectBookingDate(user, 'Booked from (UTC)', 14);
    await selectBookingDate(user, 'Booked through (UTC)', 13);
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The through date must be on or after the from date.',
    );
    expect(screen.getByLabelText('Booked through (UTC)')).toHaveFocus();
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it.each(['from', 'through'] as const)(
    'supports an optional %s date bound across a month boundary',
    async (bound) => {
      const { reads, user } = mount();
      await loaded();
      await selectBookingDate(
        user,
        bound === 'from' ? 'Booked from (UTC)' : 'Booked through (UTC)',
        31,
        9,
      );
      await user.click(screen.getByRole('button', { name: 'Apply filters' }));
      await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
      expect(
        reads.mock.calls.at(-1)![0].get(bound === 'from' ? 'from' : 'to'),
      ).toBe(
        bound === 'from'
          ? '2026-10-31T00:00:00.000Z'
          : '2026-11-01T00:00:00.000Z',
      );
      expect(
        reads.mock.calls.at(-1)![0].has(bound === 'from' ? 'to' : 'from'),
      ).toBe(false);
    },
  );

  it('supports keyboard date selection, restores trigger focus, and clears a selected day', async () => {
    const { reads, user } = mount();
    await loaded();
    const trigger = screen.getByRole('button', { name: 'Booked from (UTC)' });
    trigger.focus();
    await user.keyboard('{Enter}');
    const today = screen.getByRole('button', {
      name: /Today, Saturday, November 14th, 2026/,
    });
    expect(today).toHaveFocus();
    await user.keyboard('{ArrowLeft}{Enter}{Escape}');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent('November 13th, 2026');
    expect(reads).toHaveBeenCalledTimes(1);
    await user.click(trigger);
    const selected = screen.getByRole('button', {
      name: 'Friday, November 13th, 2026, selected',
    });
    expect(selected).toHaveFocus();
    await user.click(selected);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveTextContent('Pick a date');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(reads.mock.calls.at(-1)![0].has('from')).toBe(false);
  });

  it('uses keyboard submission and separates an empty queue from no filter matches', async () => {
    const { reads, user } = mount((params) => parcelPage(params, 0));
    await screen.findByText('No parcels are awaiting assignment');
    expect(screen.getByText('0 matching parcels')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Next' }),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText('Tracking number or recipient'),
      'missing{Enter}',
    );
    await screen.findByText('No parcels match these filters');
    expect(reads.mock.calls.at(-1)![0].get('search')).toBe('missing');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await screen.findByText('No parcels are awaiting assignment');
  });

  it('shows loading without invented totals and retries an initial failure', async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    let attempts = 0;
    const { user } = mount((params) =>
      ++attempts === 1 ? pending : parcelPage(params),
    );
    await screen.findByText('Loading unassigned parcels…');
    expect(screen.queryByText('0 matching parcels')).not.toBeInTheDocument();
    await act(async () => {
      resolve(json({ code: 'delivery_unavailable' }, 503));
      await Promise.resolve();
    });
    await screen.findByText('Unable to load unassigned parcels');
    expect(
      screen.queryByText('No parcels are awaiting assignment'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await loaded();
    expect(attempts).toBe(2);
  });

  it('retains loaded rows during refresh and a refresh failure, then recovers', async () => {
    let resolve!: (response: Response) => void;
    let attempts = 0;
    const { user } = mount((params) =>
      ++attempts === 2
        ? new Promise<Response>((done) => {
            resolve = done;
          })
        : parcelPage(params),
    );
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(screen.getByRole('status')).toHaveTextContent('Refreshing parcels…');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(
      screen.getByRole('link', { name: 'View details for TRK-1' }),
    ).toBeInTheDocument();
    await act(async () => {
      resolve(json({ code: 'delivery_unavailable' }, 503));
      await Promise.resolve();
    });
    await screen.findByText('Unable to refresh unassigned parcels');
    expect(screen.getByText('41 matching parcels')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View details for TRK-1' }),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('alert')).getByRole('button', {
        name: 'Try again',
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText('Unable to refresh unassigned parcels'),
      ).not.toBeInTheDocument(),
    );
    expect(attempts).toBe(3);
  });

  it.each([1, 0])(
    'moves to the last valid page when a refresh shrinks the queue to %s parcels',
    async (remaining) => {
      let count = 41;
      const { reads, user } = mount((params) => parcelPage(params, count));
      await loaded();
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await screen.findByText('Page 2 of 3');
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await screen.findByText('Page 3 of 3');
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
      count = remaining;
      await user.click(screen.getByRole('button', { name: 'Refresh' }));
      await screen.findByText(
        `${remaining} matching ${remaining === 1 ? 'parcel' : 'parcels'}`,
      );
      await waitFor(() =>
        expect(reads.mock.calls.at(-1)![0].get('page')).toBe('1'),
      );
      if (remaining) await screen.findByText('Page 1 of 1');
      else await screen.findByText('No parcels are awaiting assignment');
    },
  );

  it('clears the former user’s rows and filters when the authenticated account changes, including an in-flight read', async () => {
    let resolveOld!: (response: Response) => void;
    const other = {
      ...dispatcher,
      id: '00000000-0000-4000-8000-000000000099',
      fullName: 'Other Dispatcher',
    };
    const { reads, user, session, queries, setAccount } = mount(
      (params, init) => {
        if (
          new Headers(init?.headers).get('Authorization') ===
          `Bearer ${other.id}`
        )
          return json({
            items: [
              {
                ...parcels[0],
                id: 'other-parcel',
                trackingNumber: 'TRK-OTHER',
              },
            ],
            totalCount: 1,
            page: 1,
            pageSize: 20,
          });
        if (params.has('search'))
          return new Promise<Response>((done) => {
            resolveOld = done;
          });
        return parcelPage(params);
      },
    );
    await loaded();
    await chooseZone(user, 'Colombo');
    await user.type(
      screen.getByLabelText('Tracking number or recipient'),
      'old-user-search{Enter}',
    );
    await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
    setAccount(other);
    await act(async () => {
      await session.login('other@example.test', 'test-password');
    });
    await screen.findByRole('link', { name: 'View details for TRK-OTHER' });
    expect(screen.getByLabelText('Tracking number or recipient')).toHaveValue(
      '',
    );
    expect(
      screen.getByRole('combobox', { name: 'Delivery zone' }),
    ).toHaveTextContent('All delivery zones');
    await act(async () => {
      resolveOld(parcelPage(new URLSearchParams('page=1&pageSize=20')));
      await Promise.resolve();
    });
    expect(
      screen.queryByRole('link', { name: 'View details for TRK-1' }),
    ).not.toBeInTheDocument();
    expect(
      queries
        .getQueryCache()
        .getAll()
        .every((query) => query.queryKey[1] === other.id),
    ).toBe(true);
    expect(reads.mock.calls.at(-1)![0].toString()).toBe(
      'status=Created&page=1&pageSize=20',
    );
  });
});
