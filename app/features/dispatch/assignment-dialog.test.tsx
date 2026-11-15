import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IdentityApi } from '~/features/identity/api';
import { IdentityProvider, IdentitySession } from '~/features/identity/session';
import { csrf, customer, json, pair } from '~/features/identity/test-fixtures';
import type { Profile } from '~/features/identity/contracts';
import { UnassignedParcelsPage } from './unassigned-page';

const matchMedia = window.matchMedia.bind(window);
beforeEach(() => vi.stubGlobal('matchMedia', matchMedia));
const parcelId = '11111111-1111-4111-8111-111111111111';
const courierId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const candidate = {
  courierId,
  onDuty: true,
  activeCountForServiceDate: 1,
  capacity: 2,
};
const options = {
  parcelId,
  parcelVersion: 1,
  businessToday: '2026-11-14',
  operationsTimeZone: 'Asia/Colombo',
  serviceDate: '2026-11-14',
  items: [candidate],
  totalCount: 1,
  page: 1,
  pageSize: 20,
};
const receipt = {
  id: parcelId,
  trackingNumber: 'TRK-1',
  status: 'Assigned',
  version: 2,
  priceSnapshot: { total: 500, currency: 'LKR', pricingVersion: 'v1' },
  createdAt: '2026-11-14T00:00:00Z',
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function mount({
  read = (params: URLSearchParams) =>
    json({
      ...options,
      serviceDate: params.get('serviceDate') ?? options.serviceDate,
      page: Number(params.get('page')),
    }),
  write = (init?: RequestInit): Response | Promise<Response> =>
    init?.signal?.aborted
      ? Promise.reject(new DOMException('Aborted', 'AbortError'))
      : json(receipt),
  role = 'Dispatcher',
} = {}) {
  let profile: Profile = {
    ...customer,
    roles: [role as Profile['roles'][number]],
  };
  const reads = vi.fn(read),
    writes = vi.fn(write);
  let assigned = false;
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      'http://localhost',
    );
    if (url.pathname.endsWith('/auth/csrf')) return json(csrf);
    if (
      url.pathname.endsWith('/auth/refresh') ||
      url.pathname.endsWith('/auth/login')
    )
      return json(pair(profile, profile.id));
    if (url.pathname.endsWith('/zones/summary')) return json({ zones: [] });
    if (url.pathname.endsWith('/assignment-options'))
      return reads(url.searchParams);
    if (url.pathname.endsWith('/deliveries/assign')) {
      const response = await writes(init);
      if (response.ok) assigned = true;
      return response;
    }
    if (url.pathname.endsWith('/parcels'))
      return json({
        items: assigned
          ? []
          : [
              {
                ...receipt,
                status: 'Created',
                version: 1,
                updatedAt: receipt.createdAt,
                pickupCity: 'Colombo',
                deliveryCity: 'Kandy',
                recipientName: 'Recipient',
                packageDetails: { size: 'Small', weightKg: 2 },
                hasProof: false,
              },
            ],
        totalCount: assigned ? 0 : 1,
        page: 1,
        pageSize: 20,
      });
    return json({ code: 'not_found' }, 404);
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
      { path: '/403', element: <h1>403</h1> },
      { path: '/401', element: <h1>401</h1> },
    ],
    { initialEntries: ['/dispatch/unassigned'] },
  );
  render(
    <StrictMode>
      <QueryClientProvider client={queries}>
        <IdentityProvider session={session}>
          <RouterProvider router={router} />
        </IdentityProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
  return {
    user: userEvent.setup(),
    reads,
    writes,
    queries,
    session,
    setProfile: (next: Profile) => {
      profile = next;
    },
  };
}
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'Assign courier for TRK-1' }),
  );
  await screen.findByRole('button', { name: `Select courier ${courierId}` });
}
it.each(['Dispatcher', 'Admin'])(
  'confirms an assignment and refreshes the queue for %s',
  async (role) => {
    const { user, writes } = mount({ role });
    await open(user);
    expect(
      screen.getByRole('button', { name: 'Confirm assignment' }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: `Select courier ${courierId}` }),
    );
    expect(writes).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Confirm assignment' }),
    );
    await screen.findByText(/Assignment confirmed\./);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes.mock.calls[0]?.[0]?.body).toBe(
      JSON.stringify({
        parcelId,
        courierId,
        expectedVersion: 1,
        reassign: false,
        serviceDate: '2026-11-14',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await screen.findByText('No parcels are awaiting assignment');
  },
);
it('uses the official calendar, clears selection and allows off-duty future candidates', async () => {
  const { user, reads } = mount({
    read: (params) =>
      json({
        ...options,
        serviceDate: params.get('serviceDate') ?? options.serviceDate,
        items: [{ ...candidate, onDuty: !params.has('serviceDate') }],
      }),
  });
  await open(user);
  await user.click(
    screen.getByRole('button', { name: `Select courier ${courierId}` }),
  );
  await user.click(screen.getByRole('button', { name: 'Service date' }));
  const popover = screen.getByRole('dialog', { name: 'Service date' });
  await user.click(
    within(popover).getByRole('button', {
      name: /Sunday, November 15th, 2026/,
    }),
  );
  await waitFor(() =>
    expect(reads.mock.calls.at(-1)?.[0].get('serviceDate')).toBe('2026-11-15'),
  );
  await screen.findByText('No', { exact: true });
  expect(
    screen.getByRole('button', { name: 'Confirm assignment' }),
  ).toBeDisabled();
});
it('requires a fresh selection after a definite capacity conflict', async () => {
  const { user, writes } = mount({
    write: () => json({ code: 'capacity_exceeded' }, 422),
  });
  await open(user);
  await user.click(
    screen.getByRole('button', { name: `Select courier ${courierId}` }),
  );
  await user.click(screen.getByRole('button', { name: 'Confirm assignment' }));
  await screen.findByText(/This courier is full/);
  expect(
    screen.getByRole('button', { name: 'Confirm assignment' }),
  ).toBeDisabled();
  await user.click(
    screen.getByRole('button', { name: 'Reload available couriers' }),
  );
  expect(
    screen.getByRole('button', { name: 'Confirm assignment' }),
  ).toBeDisabled();
  expect(writes).toHaveBeenCalledTimes(1);
});
it('retains an uncertain request, prevents dismissal and retries only on explicit action', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));
  let calls = 0;
  const { user, writes } = mount({
    write: () => {
      if (calls++ === 0) throw new TypeError('lost response');
      return json(receipt);
    },
  });
  await open(user);
  await user.click(
    screen.getByRole('button', { name: `Select courier ${courierId}` }),
  );
  await user.click(screen.getByRole('button', { name: 'Confirm assignment' }));
  await screen.findByText(/The outcome is uncertain/);
  expect(screen.getByRole('button', { name: /^Cancel$/ })).toBeDisabled();
  await user.keyboard('{Escape}');
  expect(
    screen.getByRole('dialog', { name: 'Assign courier' }),
  ).toBeInTheDocument();
  expect(writes).toHaveBeenCalledTimes(1);
  vi.setSystemTime(new Date('2026-11-14T12:00:02Z'));
  const retry = await screen.findByRole('button', {
    name: 'Retry same assignment',
  });
  await user.click(retry);
  await screen.findByText(/Assignment confirmed\./);
  expect(writes).toHaveBeenCalledTimes(2);
  expect(writes.mock.calls[0]?.[0]?.body).toBe(writes.mock.calls[1]?.[0]?.body);
  expect(writes.mock.calls[0]?.[0]?.headers).toEqual(
    writes.mock.calls[1]?.[0]?.headers,
  );
});
it('keeps failed and empty availability distinct and supports a safe read retry', async () => {
  let recovered = false;
  const { user, writes } = mount({
    read: () =>
      recovered
        ? json({ ...options, items: [], totalCount: 0 })
        : json({ code: 'delivery_unavailable' }, 503),
  });
  await user.click(
    await screen.findByRole('button', { name: 'Assign courier for TRK-1' }),
  );
  await screen.findByText('Available couriers could not be loaded');
  expect(screen.queryByText('No eligible couriers')).not.toBeInTheDocument();
  recovered = true;
  await user.click(
    within(screen.getByRole('dialog', { name: 'Assign courier' })).getByRole(
      'button',
      { name: 'Try again' },
    ),
  );
  await screen.findByText('No eligible couriers');
  expect(writes).not.toHaveBeenCalled();
});
it('discards a previous account’s pending attempt and late result', async () => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>((r) => {
    resolve = r;
  });
  const { user, session, setProfile, queries } = mount({
    write: () => pending,
  });
  await open(user);
  await user.click(
    screen.getByRole('button', { name: `Select courier ${courierId}` }),
  );
  await user.click(screen.getByRole('button', { name: 'Confirm assignment' }));
  setProfile({ ...customer, id: otherId, roles: ['Dispatcher'] });
  await act(() => session.login('other@example.test', 'fixture-password'));
  expect(
    screen.queryByRole('dialog', { name: 'Assign courier' }),
  ).not.toBeInTheDocument();
  await act(async () => {
    resolve(json(receipt));
    await pending;
  });
  expect(screen.queryByText(/Assignment confirmed\./)).not.toBeInTheDocument();
  expect(
    queries
      .getQueryCache()
      .findAll({ queryKey: ['dispatch-assignment-options', customer.id] }),
  ).toHaveLength(0);
});
