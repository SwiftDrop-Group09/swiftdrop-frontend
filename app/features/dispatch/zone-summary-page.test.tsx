import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { format } from 'date-fns';
import { createAppQueryClient } from '~/shared/query-client';
import { IdentityApi } from '~/features/identity/api';
import type { Profile } from '~/features/identity/contracts';
import { IdentityProvider, IdentitySession } from '~/features/identity/session';
import { customer, csrf, json, pair } from '~/features/identity/test-fixtures';
import type { ZoneSummaryResponse } from '~/features/admin-delivery/contracts';
import { UnassignedParcelsPage } from './unassigned-page';
import { CourierWorkloadPage } from './workload-page';
import { ZoneSummaryPage } from './zone-summary-page';

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
const zones: ZoneSummaryResponse['zones'] = [
  {
    zoneId: '00000000-0000-4000-8000-000000000010',
    name: 'Colombo service area with a long descriptive name',
    total: 12,
    statusCounts: { Delivered: 3, Created: 7, Returned: 2 },
  },
  {
    zoneId: '00000000-0000-4000-8000-000000000020',
    name: 'Empty zone',
    total: 0,
    statusCounts: {},
  },
];

function mount(
  read: (
    params: URLSearchParams,
    init?: RequestInit,
  ) => Response | Promise<Response> = () => json({ zones }),
  signedIn: Profile | null = dispatcher,
) {
  let account = signedIn;
  const reads = vi.fn(read);
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
    if (url.pathname === '/api/v1/zones/summary')
      return Promise.resolve(reads(url.searchParams, init));
    if (url.pathname === '/api/v1/couriers/workload')
      return Promise.resolve(
        json({
          items: [
            {
              courierId: '00000000-0000-4000-8000-000000000030',
              courierCode: 'COU-0030',
              active: true,
              onDuty: true,
              activeCount: 0,
              capacity: 5,
              zoneIds: [zones[1]!.zoneId],
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 20,
        }),
      );
    if (url.pathname === '/api/v1/parcels')
      return Promise.resolve(
        json({ items: [], totalCount: 0, page: 1, pageSize: 20 }),
      );
    return Promise.resolve(json({ code: 'not_found' }, 404));
  });
  vi.stubGlobal('fetch', fetcher);
  const queries = createAppQueryClient();
  const session = new IdentitySession(new IdentityApi(fetcher), () =>
    queries.clear(),
  );
  const router = createMemoryRouter(
    [
      { path: '/dispatch/zones', element: <ZoneSummaryPage /> },
      { path: '/dispatch/unassigned', element: <UnassignedParcelsPage /> },
      { path: '/dispatch/workload', element: <CourierWorkloadPage /> },
      { path: '/away', element: <h1>Away</h1> },
      { path: '/401', element: <h1>401</h1> },
      { path: '/403', element: <h1>403</h1> },
    ],
    { initialEntries: ['/dispatch/zones'] },
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
  await screen.findByRole('cell', { name: zones[0]!.name });
}
async function openPeriod(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Reporting period' }));
}
async function selectDate(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  day: number,
) {
  await user.click(screen.getByRole('button', { name: label }));
  const calendar = screen.getByRole('dialog', { name: label });
  await user.click(
    within(calendar).getByRole('button', {
      name: new RegExp(format(new Date(2026, 10, day), 'PPPP')),
    }),
  );
}

describe('Dispatcher zone summary', () => {
  it.each(['Dispatcher', 'Admin'] as const)(
    'uses an all-date private summary for %s with the existing table design',
    async (role) => {
      const { reads, queries } = mount(undefined, {
        ...dispatcher,
        roles: [role],
      });
      await loaded();
      expect(reads.mock.calls[0]![0].toString()).toBe('');
      expect(
        queries.getQueryData(['delivery-zone-summary', dispatcher.id]),
      ).toEqual({ zones });
      expect(
        screen.getByRole('button', { name: 'Reporting period' }),
      ).toHaveTextContent('All booking dates');
      expect(
        screen.getAllByRole('columnheader').map((cell) => cell.textContent),
      ).toEqual(['Zone', 'Total parcels', 'Status breakdown']);
      const row = screen
        .getByRole('cell', { name: zones[0]!.name })
        .closest('tr')!;
      expect(within(row).getByRole('cell', { name: '12' })).toBeInTheDocument();
      expect(within(row).getByText('Returned: 2')).toBeInTheDocument();
      expect(
        screen.getByRole('cell', { name: 'Empty zone' }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    },
  );

  it('uses the API total without reconstructing it from recognized statuses', async () => {
    mount(() =>
      json({
        zones: [{ ...zones[0], total: 101, statusCounts: { Created: 1 } }],
      }),
    );
    await loaded();
    expect(screen.getByRole('cell', { name: '101' })).toBeInTheDocument();
  });

  it('separates loading, initial failure, retry and an empty zone catalog', async () => {
    let resolve!: (response: Response) => void;
    let attempts = 0;
    const { user } = mount(() =>
      ++attempts === 1
        ? new Promise<Response>((done) => {
            resolve = done;
          })
        : json({ zones: [] }),
    );
    await screen.findByText('Loading zone summary…');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await act(async () => {
      resolve(json({ code: 'delivery_unavailable' }, 503));
      await Promise.resolve();
    });
    await screen.findByText('Unable to load zone summary');
    expect(
      screen.queryByText('No delivery zones configured'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('No delivery zones configured');
    expect(
      screen.queryByText('Unable to load zone summary'),
    ).not.toBeInTheDocument();
  });

  it('retains this period’s loaded rows during refresh and failed refresh, then recovers', async () => {
    let resolve!: (response: Response) => void;
    let attempts = 0;
    const { user } = mount(() =>
      ++attempts === 2
        ? new Promise<Response>((done) => {
            resolve = done;
          })
        : json({ zones }),
    );
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(screen.getByText('Refreshing zone summary…')).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: zones[0]!.name }),
    ).toBeInTheDocument();
    await act(async () => {
      resolve(json({ code: 'delivery_unavailable' }, 503));
      await Promise.resolve();
    });
    await screen.findByText('Unable to refresh zone summary');
    expect(
      screen.getByText(/Showing previously loaded results for this period/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: zones[0]!.name }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Unable to refresh zone summary'),
      ).not.toBeInTheDocument(),
    );
    expect(attempts).toBe(3);
  });

  it('applies complete Calendar dates as inclusive UTC days and clears to the existing catalog cache', async () => {
    const { user, reads, queries } = mount();
    await loaded();
    await openPeriod(user);
    await selectDate(user, 'From', 13);
    expect(screen.getByRole('button', { name: 'From' })).toHaveFocus();
    await selectDate(user, 'Through', 14);
    expect(reads).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByLabelText('From', { selector: 'input' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply dates' }));
    await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
    const params = reads.mock.calls[1]![0];
    expect(params.get('from')).toBe('2026-11-13T00:00:00.000Z');
    expect(params.get('to')).toBe('2026-11-15T00:00:00.000Z');
    expect(
      queries.getQueryData([
        'delivery-zone-summary',
        dispatcher.id,
        params.get('from'),
        params.get('to'),
      ]),
    ).toEqual({ zones });
    expect(
      queries.getQueryData(['delivery-zone-summary', dispatcher.id]),
    ).toEqual({ zones });
    await openPeriod(user);
    await user.click(screen.getByRole('button', { name: 'Clear dates' }));
    expect(
      screen.getByRole('button', { name: 'Reporting period' }),
    ).toHaveTextContent('All booking dates');
    await loaded();
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('rejects incomplete and reversed drafts without querying, and Cancel discards edits', async () => {
    const { user, reads } = mount();
    await loaded();
    await openPeriod(user);
    await selectDate(user, 'From', 14);
    await user.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(screen.getByText('Invalid reporting period')).toBeInTheDocument();
    await selectDate(user, 'Through', 13);
    await user.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(screen.getByText('Invalid reporting period')).toBeInTheDocument();
    expect(reads).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await openPeriod(user);
    expect(screen.getByRole('button', { name: 'From' })).toHaveTextContent(
      'Pick a date',
    );
    expect(screen.getByRole('button', { name: 'Through' })).toHaveTextContent(
      'Pick a date',
    );
  });

  it('supports keyboard calendar selection, Escape and focus restoration', async () => {
    const { user, reads } = mount();
    await loaded();
    await openPeriod(user);
    const trigger = screen.getByRole('button', { name: 'From' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /Today, Saturday, November 14th, 2026/,
        }),
      ).toHaveFocus(),
    );
    await user.keyboard('{ArrowLeft}{Enter}');
    expect(trigger).toHaveTextContent('Nov 13, 2026');
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('button', { name: 'Reporting period' }),
    ).toHaveFocus();
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('never shows another period’s rows while a new request loads or fails', async () => {
    let resolve!: (response: Response) => void;
    const { user } = mount((params) =>
      params.has('from')
        ? new Promise<Response>((done) => {
            resolve = done;
          })
        : json({ zones }),
    );
    await loaded();
    await openPeriod(user);
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await screen.findByText('Loading zone summary…');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await act(async () => {
      resolve(json({ code: 'delivery_unavailable' }, 503));
      await Promise.resolve();
    });
    await screen.findByText('Unable to load zone summary');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Showing previously loaded/),
    ).not.toBeInTheDocument();
  });

  it('invalidates dated summaries through the existing user prefix', async () => {
    const { user, reads, queries } = mount();
    await loaded();
    await openPeriod(user);
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
    await loaded();
    await act(async () => {
      await queries.invalidateQueries({
        queryKey: ['delivery-zone-summary', dispatcher.id],
      });
    });
    expect(reads).toHaveBeenCalledTimes(3);
    expect(reads.mock.calls[2]![0].get('from')).toBe(
      '2026-11-14T00:00:00.000Z',
    );
    expect(
      queries.getQueryState(['delivery-zone-summary', dispatcher.id])
        ?.isInvalidated,
    ).toBe(true);
  });

  it.each(['/dispatch/unassigned', '/dispatch/workload'])(
    'keeps the undated catalog separate for %s',
    async (path) => {
      const { user, queries, reads, router } = mount((params) =>
        json({
          zones: params.has('from')
            ? [{ ...zones[0], total: 1, statusCounts: { Created: 1 } }]
            : zones,
        }),
      );
      await loaded();
      await openPeriod(user);
      await user.click(screen.getByRole('button', { name: 'Today' }));
      await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
      await loaded();
      await act(async () => {
        await router.navigate(path);
      });
      if (path === '/dispatch/unassigned') {
        await screen.findByRole('combobox', { name: 'Delivery zone' });
        await user.click(
          screen.getByRole('combobox', { name: 'Delivery zone' }),
        );
        expect(
          screen.getByRole('option', { name: 'Empty zone' }),
        ).toBeInTheDocument();
      } else {
        await screen.findByText('Empty zone');
      }
      expect(
        queries.getQueryData(['delivery-zone-summary', dispatcher.id]),
      ).toEqual({ zones });
      expect(reads).toHaveBeenCalledTimes(2);
    },
  );

  it('aborts an obsolete period request when navigating away', async () => {
    const { user, reads, router } = mount((params) =>
      params.has('from') ? new Promise<Response>(() => {}) : json({ zones }),
    );
    await loaded();
    await openPeriod(user);
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
    const signal = reads.mock.calls[1]![1]?.signal;
    expect(signal?.aborted).toBe(false);
    await act(async () => {
      await router.navigate('/away');
    });
    await waitFor(() => expect(signal?.aborted).toBe(true));
  });

  it('clears old rows and range on account change and ignores the old in-flight result', async () => {
    let resolve!: (response: Response) => void;
    const other = {
      ...dispatcher,
      id: '00000000-0000-4000-8000-000000000099',
      fullName: 'Other dispatcher',
    };
    const { user, reads, session, queries, setAccount } = mount(
      (params, init) => {
        if (
          new Headers(init?.headers).get('Authorization') ===
          `Bearer ${other.id}`
        )
          return json({ zones: [{ ...zones[1], name: 'Other account zone' }] });
        return params.has('from')
          ? new Promise<Response>((done) => {
              resolve = done;
            })
          : json({ zones });
      },
    );
    await loaded();
    await openPeriod(user);
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
    const signal = reads.mock.calls[1]![1]?.signal;
    setAccount(other);
    await act(async () => {
      await session.login('other@example.test', 'test-password');
    });
    await screen.findByRole('cell', { name: 'Other account zone' });
    expect(
      screen.getByRole('button', { name: 'Reporting period' }),
    ).toHaveTextContent('All booking dates');
    expect(reads.mock.calls.at(-1)![0].toString()).toBe('');
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolve(json({ zones }));
      await Promise.resolve();
    });
    expect(
      screen.queryByRole('cell', { name: zones[0]!.name }),
    ).not.toBeInTheDocument();
    expect(
      queries
        .getQueryCache()
        .getAll()
        .some((query) => query.queryKey[1] === dispatcher.id),
    ).toBe(false);
  });

  it.each(['Customer', 'Courier', 'Merchant'] as const)(
    'blocks %s before private reads',
    async (role) => {
      const { reads } = mount(undefined, { ...dispatcher, roles: [role] });
      await screen.findByRole('heading', { name: '403' });
      expect(reads).not.toHaveBeenCalled();
    },
  );

  it('sends signed-out users to authentication before private reads', async () => {
    const { reads } = mount(undefined, null);
    await screen.findByRole('heading', { name: '401' });
    expect(reads).not.toHaveBeenCalled();
  });
});
