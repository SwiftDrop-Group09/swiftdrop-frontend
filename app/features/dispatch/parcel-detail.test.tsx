import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from '~/shared/query-client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IdentityApi } from '~/features/identity/api';
import { IdentityProvider, IdentitySession } from '~/features/identity/session';
import type { Profile } from '~/features/identity/contracts';
import { csrf, customer, json, pair } from '~/features/identity/test-fixtures';
import DispatcherParcel from '~/portals/dispatcher/parcel';
import { ParcelLiveDetail } from '~/features/customer-tracking/tracking-page';

const matchMedia = window.matchMedia.bind(window);
beforeEach(() => vi.stubGlobal('matchMedia', matchMedia));
const parcelId = '11111111-1111-4111-8111-111111111111';
const oldId = '22222222-2222-4222-8222-222222222222';
const targetId = '33333333-3333-4333-8333-333333333333';
const base = {
  id: parcelId,
  trackingNumber: 'DETAIL-1',
  status: 'Assigned',
  version: 2,
  priceSnapshot: { total: 500, currency: 'LKR', pricingVersion: 'v1' },
  createdAt: '2026-11-14T00:00:00Z',
  pickupAddress: {
    street: 'Pickup',
    city: 'Colombo',
    postalCode: '00100',
    zoneId: oldId,
  },
  deliveryAddress: {
    street: 'Dropoff',
    city: 'Kandy',
    postalCode: '20000',
    zoneId: oldId,
  },
  packageDetails: { size: 'Small', weightKg: 2 },
  recipient: { name: 'Recipient', phoneNumber: '0000000000' },
  assignment: {
    status: 'Active',
    serviceDate: '2026-11-16',
    assignedAt: '2026-11-14T01:00:00Z',
    pickedUpAt: null,
    deliveredAt: null,
  },
  history: [],
};
afterEach(() => vi.unstubAllGlobals());
function mount({
  role = 'Dispatcher',
  status = 'Assigned',
  pickedUp = false,
  customerView = false,
  write = (_init?: RequestInit): Response | Promise<Response> => {
    void _init;
    return json({ ...base, version: 3 });
  },
} = {}) {
  let profile: Profile = {
    ...customer,
    roles: [role as Profile['roles'][number]],
  };
  let detail = {
    ...base,
    status,
    assignment: {
      ...base.assignment,
      pickedUpAt: pickedUp ? '2026-11-14T02:00:00Z' : null,
    },
  };
  const reads: string[] = [],
    writes = vi.fn(write);
  let optionsVersion = '9007199254740993';
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
    reads.push(url.pathname);
    if (url.pathname.endsWith(`/parcels/${parcelId}`)) return json(detail);
    if (url.pathname.endsWith('/events'))
      return json({ code: 'delivery_unavailable' }, 503);
    if (url.pathname.endsWith('/courier-directory'))
      return json(
        url.searchParams
          .get('ids')!
          .split(',')
          .map((id) => ({
            id,
            fullName: id === oldId ? 'Courier Original' : 'Courier Replacement',
          })),
      );
    if (url.pathname.endsWith('/assignment-options'))
      return new Response(
        JSON.stringify({
          parcelId,
          parcelVersion: 2,
          reassign: true,
          currentAssignment: {
            courierId: oldId,
            courierCode: 'COU-0001',
            serviceDate: '2026-11-16',
          },
          businessToday: '2026-11-14',
          operationsTimeZone: 'Asia/Colombo',
          serviceDate: '2026-11-16',
          items: [
            {
              courierId: targetId,
              courierCode: 'COU-0002',
              onDuty: false,
              activeCountForServiceDate: 0,
              capacity: 2,
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 20,
        }).replace('"parcelVersion":2', `"parcelVersion":${optionsVersion}`),
      );
    if (url.pathname.endsWith('/deliveries/assign')) {
      const response = await writes(init);
      if (response.ok) detail = { ...detail, version: 3 };
      return response;
    }
    return json({ code: 'not_found' }, 404);
  });
  vi.stubGlobal('fetch', fetcher);
  const queries = createAppQueryClient();
  const session = new IdentitySession(new IdentityApi(fetcher), () =>
    queries.clear(),
  );
  const router = createMemoryRouter(
    [
      {
        path: '/dispatch/parcels/:id',
        element: customerView ? (
          <ParcelLiveDetail parcelId={parcelId} />
        ) : (
          <DispatcherParcel />
        ),
      },
      { path: '/403', element: <h1>403</h1> },
      { path: '/401', element: <h1>401</h1> },
    ],
    { initialEntries: [`/dispatch/parcels/${parcelId}`] },
  );
  render(
    <QueryClientProvider client={queries}>
      <IdentityProvider session={session}>
        <RouterProvider router={router} />
      </IdentityProvider>
    </QueryClientProvider>,
  );
  return {
    user: userEvent.setup(),
    writes,
    reads,
    queries,
    session,
    setOptionsVersion: (version: string) => {
      optionsVersion = version;
    },
    setProfile: (next: Profile) => {
      profile = next;
    },
    setPickedUp: () => {
      detail = { ...detail, status: 'PickedUp' };
    },
  };
}
it.each(['Dispatcher', 'Admin'])(
  'integrates the action, exact options version, refresh and focus for %s',
  async (role) => {
    const { user, writes, queries } = mount({
      role,
      write: () =>
        new Response(
          JSON.stringify({ ...base, version: 3 }).replace(
            '"version":3',
            '"version":9007199254740994',
          ),
        ),
    });
    const invalidate = vi.spyOn(queries, 'invalidateQueries');
    await user.click(
      await screen.findByRole('button', { name: 'Reassign courier' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: 'Select courier Courier Replacement · COU-0002',
      }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Reassignment reason' }),
      'Replacement required',
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirm reassignment' }),
    );
    await screen.findByText(/Reassignment confirmed/);
    expect(writes.mock.calls[0]?.[0]?.body).toContain(
      '"expectedVersion":9007199254740993',
    );
    for (const prefix of [
      'customer-parcel',
      'dispatch-workload',
      'dispatch-assignments',
      'dispatch-assignment-options',
      'delivery-zone-summary',
    ])
      expect(
        invalidate.mock.calls.some(
          ([filter]) => filter?.queryKey?.[0] === prefix,
        ),
      ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Reassign courier' }),
      ).toHaveFocus(),
    );
  },
);
it('refreshes eligibility when reopening within the shared cache freshness window', async () => {
  const { user, reads, writes, setOptionsVersion } = mount({
    write: () =>
      new Response(
        JSON.stringify({ ...base, version: 3 }).replace(
          '"version":3',
          '"version":9007199254740995',
        ),
      ),
  });
  await user.click(
    await screen.findByRole('button', { name: 'Reassign courier' }),
  );
  await screen.findByRole('button', {
    name: 'Select courier Courier Replacement · COU-0002',
  });
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  const previousReads = reads.filter((path) =>
    path.endsWith('/assignment-options'),
  ).length;
  setOptionsVersion('9007199254740994');
  await user.click(screen.getByRole('button', { name: 'Reassign courier' }));
  await waitFor(() =>
    expect(
      reads.filter((path) => path.endsWith('/assignment-options')),
    ).toHaveLength(previousReads + 1),
  );
  await user.click(
    await screen.findByRole('button', {
      name: 'Select courier Courier Replacement · COU-0002',
    }),
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Reassignment reason' }),
    'Replacement required',
  );
  await user.click(
    screen.getByRole('button', { name: 'Confirm reassignment' }),
  );
  await screen.findByText(/Reassignment confirmed/);
  expect(writes.mock.calls[0]?.[0]?.body).toContain(
    '"expectedVersion":9007199254740994',
  );
});
it.each(['Customer', 'Courier', 'Merchant'])(
  'denies %s before mounting operational detail or options',
  async (role) => {
    const { reads } = mount({ role });
    await screen.findByRole('heading', { name: '403' });
    expect(
      reads.some(
        (path) =>
          path.includes('/parcels/') || path.endsWith('/assignment-options'),
      ),
    ).toBe(false);
  },
);
it.each([
  ['PickedUp', true],
  ['Assigned', true],
  ['Failed', false],
  ['Created', false],
])('hides the action for %s / pickup=%s', async (status, pickedUp) => {
  mount({ status, pickedUp });
  await screen.findByRole('heading', { name: 'DETAIL-1' });
  expect(
    screen.queryByRole('button', { name: 'Reassign courier' }),
  ).not.toBeInTheDocument();
});
it('keeps a pending dialog through parcel refresh but discards it on account change', async () => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>((r) => {
    resolve = r;
  });
  const { user, queries, session, setProfile, setPickedUp } = mount({
    write: () => pending,
  });
  await user.click(
    await screen.findByRole('button', { name: 'Reassign courier' }),
  );
  await user.click(
    await screen.findByRole('button', {
      name: 'Select courier Courier Replacement · COU-0002',
    }),
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Reassignment reason' }),
    'Replacement required',
  );
  await user.click(
    screen.getByRole('button', { name: 'Confirm reassignment' }),
  );
  setPickedUp();
  await act(() =>
    queries.invalidateQueries({ queryKey: ['customer-parcel', parcelId] }),
  );
  expect(
    screen.getByRole('dialog', { name: 'Reassign courier' }),
  ).toBeInTheDocument();
  setProfile({ ...customer, id: oldId, roles: ['Dispatcher'] });
  await act(() => session.login('other@example.test', 'fixture-password'));
  expect(
    screen.queryByRole('dialog', { name: 'Reassign courier' }),
  ).not.toBeInTheDocument();
  await act(async () => {
    resolve(json({ ...base, version: 3 }));
    await pending;
  });
  expect(screen.queryByText(/Reassignment confirmed/)).not.toBeInTheDocument();
});
it('keeps the Customer detail free of Dispatcher actions', async () => {
  mount({ role: 'Customer', customerView: true });
  await screen.findByRole('heading', { name: 'DETAIL-1' });
  expect(
    screen.queryByRole('button', { name: 'Reassign courier' }),
  ).not.toBeInTheDocument();
});
