import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createAdminDeliveryApi } from '~/features/admin-delivery/api';
import { IdentityApi } from '~/features/identity/api';
import type { Profile } from '~/features/identity/contracts';
import { IdentityProvider, IdentitySession } from '~/features/identity/session';
import { csrf, customer, json, pair } from '~/features/identity/test-fixtures';
import DispatcherParcel from '~/portals/dispatcher/parcel';
import DashboardRoute from '~/portals/customer/dashboard';
import { createAppQueryClient } from '~/shared/query-client';
import { CourierWorkloadPage } from './workload-page';
import { UnassignedParcelsPage } from './unassigned-page';
import { ZoneSummaryPage } from './zone-summary-page';

const matchMedia = window.matchMedia.bind(window);
beforeEach(() => vi.stubGlobal('matchMedia', matchMedia));
afterEach(() => vi.unstubAllGlobals());
const parcelId = '11111111-1111-4111-8111-111111111111';
const courierA = '22222222-2222-4222-8222-222222222222';
const courierB = '33333333-3333-4333-8333-333333333333';
const zoneId = '44444444-4444-4444-8444-444444444444';
const from = '2026-11-14T00:00:00.000Z';
const to = '2026-11-15T00:00:00.000Z';
const parcel = {
  id: parcelId,
  trackingNumber: 'WORKFLOW-1',
  priceSnapshot: { total: 500, currency: 'LKR', pricingVersion: 'v1' },
  createdAt: from,
  pickupAddress: {
    street: 'Pickup',
    city: 'Colombo',
    postalCode: '00100',
    zoneId,
  },
  deliveryAddress: {
    street: 'Dropoff',
    city: 'Kandy',
    postalCode: '20000',
    zoneId,
  },
  packageDetails: { size: 'Small', weightKg: 2 },
  recipient: { name: 'Fixture recipient', phoneNumber: '0000000000' },
  history: [],
};

function mount(role: 'Dispatcher' | 'Admin') {
  const profile: Profile = { ...customer, roles: [role] };
  let courier: string | null = null;
  let version = 1;
  const writes: { body: string; key: string }[] = [];
  const reads: string[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    await Promise.resolve();
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      'http://localhost',
    );
    if (url.pathname.endsWith('/auth/csrf')) return json(csrf);
    if (url.pathname.endsWith('/auth/refresh')) return json(pair(profile));
    const status = courier ? 'Assigned' : 'Created';
    const page = { totalCount: 0, page: 1, pageSize: 20 };
    if (url.pathname.endsWith('/deliveries/assign')) {
      if (typeof init?.body !== 'string')
        throw new Error('Assignment must retain its serialized request bytes.');
      const body = init.body;
      const command = JSON.parse(body) as { courierId: string };
      writes.push({
        body,
        key: new Headers(init?.headers).get('Idempotency-Key')!,
      });
      courier = command.courierId;
      return json({ ...parcel, status: 'Assigned', version: ++version });
    }
    reads.push(url.pathname + url.search);
    if (url.pathname.endsWith('/users/courier-directory'))
      return json([
        { id: courierA, fullName: 'Courier Alpha' },
        { id: courierB, fullName: 'Courier Beta' },
      ]);
    if (url.pathname.endsWith('/couriers/workload'))
      return json({
        ...page,
        totalCount: 2,
        items: [courierA, courierB].map((id, index) => ({
          courierId: id,
          courierCode: `COU-000${index + 1}`,
          active: true,
          onDuty: true,
          activeCount: courier === id ? 1 : 0,
          capacity: 2,
          zoneIds: [zoneId],
        })),
      });
    if (url.pathname.endsWith('/assignments')) {
      const selected = url.pathname.split('/').at(-2)!;
      return json({
        ...page,
        courierId: selected,
        totalCount: courier === selected ? 1 : 0,
        items:
          courier === selected
            ? [
                {
                  parcelId,
                  trackingNumber: parcel.trackingNumber,
                  status,
                  serviceDate: '2026-11-14',
                  assignedAt: from,
                },
              ]
            : [],
      });
    }
    if (url.pathname.endsWith('/zones/summary'))
      return json({
        zones: [
          {
            zoneId,
            name: 'Workflow zone',
            total: 1,
            statusCounts: { [status]: 1 },
          },
        ],
      });
    if (url.pathname.endsWith('/assignment-options')) {
      const reassign = url.searchParams.get('reassign') === 'true';
      return json({
        parcelId,
        parcelVersion: version,
        businessToday: '2026-11-14',
        operationsTimeZone: 'Asia/Colombo',
        serviceDate: '2026-11-14',
        reassign,
        currentAssignment: reassign
          ? { courierId: courier, serviceDate: '2026-11-14' }
          : null,
        items: [
          {
            courierId: reassign ? courierB : courierA,
            onDuty: true,
            activeCountForServiceDate: 0,
            capacity: 2,
          },
        ],
        ...page,
        totalCount: 1,
      });
    }
    if (url.pathname.endsWith('/parcels'))
      return json({
        ...page,
        totalCount: courier ? 0 : 1,
        items: courier
          ? []
          : [
              {
                ...parcel,
                status,
                version,
                updatedAt: from,
                pickupCity: 'Colombo',
                deliveryCity: 'Kandy',
                recipientName: 'Fixture recipient',
                hasProof: false,
              },
            ],
      });
    if (url.pathname.endsWith(`/parcels/${parcelId}`))
      return json({
        ...parcel,
        status,
        version,
        assignment: courier
          ? {
              status: 'Active',
              serviceDate: '2026-11-14',
              assignedAt: from,
              pickedUpAt: null,
              deliveredAt: null,
            }
          : null,
      });
    if (url.pathname.endsWith('/events'))
      return json({ code: 'delivery_unavailable' }, 503);
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const queries = createAppQueryClient();
  const session = new IdentitySession(new IdentityApi(fetcher), () =>
    queries.clear(),
  );
  const router = createMemoryRouter(
    [
      { path: '/dashboard', element: <DashboardRoute /> },
      { path: '/dispatch/unassigned', element: <UnassignedParcelsPage /> },
      { path: '/dispatch/workload', element: <CourierWorkloadPage /> },
      { path: '/dispatch/zones', element: <ZoneSummaryPage /> },
      { path: '/dispatch/parcels/:id', element: <DispatcherParcel /> },
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
    queries,
    session,
    router,
    reads,
    writes,
    user: userEvent.setup(),
    profile,
  };
}

it.each(['Dispatcher', 'Admin'] as const)(
  'refreshes cached queue, detail, both couriers and dated summaries across assignment and reassignment for %s',
  async (role) => {
    const { queries, session, router, reads, writes, user, profile } =
      mount(role);
    const datedKey = ['delivery-zone-summary', profile.id, from, to];
    const unrelatedKeys = [
      ['delivery-zone-summary', 'another-account', from, to],
      ['dispatch-workload', 'another-account', 1],
      ['customer-parcels', profile.id, false, {}],
    ];
    const navigate = async (path: string) => act(() => router.navigate(path));
    const readDated = () =>
      queries.fetchQuery({
        queryKey: datedKey,
        queryFn: () => createAdminDeliveryApi(session).getZoneSummary(from, to),
      });
    await screen.findByText('Courier Alpha');
    if (role === 'Dispatcher') {
      await navigate('/dashboard');
      await screen.findByRole('link', { name: parcel.trackingNumber });
      expect(screen.getByLabelText('Awaiting assignment')).toHaveTextContent(
        '1',
      );
      expect(screen.getByLabelText('In progress')).toHaveTextContent('0');
      await navigate('/dispatch/workload');
    }
    for (const code of ['COU-0001', 'COU-0002']) {
      await user.click(
        screen.getByRole('button', { name: `View active parcels for ${code}` }),
      );
      await screen.findByText('No active assignments');
      await user.click(screen.getByRole('button', { name: 'Close' }));
    }
    await readDated();
    for (const key of unrelatedKeys)
      queries.setQueryData(key, { sentinel: true });
    await navigate(`/dispatch/parcels/${parcelId}`);
    await screen.findByRole('heading', { name: parcel.trackingNumber });
    await navigate('/dispatch/unassigned');
    await user.click(
      await screen.findByRole('button', {
        name: `Assign courier for ${parcel.trackingNumber}`,
      }),
    );
    await user.click(
      await screen.findByRole('button', { name: `Select courier ${courierA}` }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirm assignment' }),
    );
    await screen.findByText(/Assignment confirmed/);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled(),
    );
    expect(queries.getQueryState(datedKey)?.isInvalidated).toBe(true);
    expect(
      queries.getQueryState(['customer-parcel', parcelId, profile.id, true])
        ?.isInvalidated,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(
      screen.queryByRole('button', {
        name: `Assign courier for ${parcel.trackingNumber}`,
      }),
    ).not.toBeInTheDocument();
    expect((await readDated()).zones[0]?.statusCounts).toEqual({ Assigned: 1 });
    await workload(1, 0);
    if (role === 'Dispatcher') await dashboard(1, 0);

    await navigate(`/dispatch/parcels/${parcelId}`);
    await user.click(
      await screen.findByRole('button', { name: 'Reassign courier' }),
    );
    await user.click(
      await screen.findByRole('button', { name: `Select courier ${courierB}` }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Reassignment reason' }),
      'Replacement needed',
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirm reassignment' }),
    );
    await screen.findByText(/Reassignment confirmed/);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled(),
    );
    expect(queries.getQueryState(datedKey)?.isInvalidated).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await workload(0, 1);
    if (role === 'Dispatcher') await dashboard(0, 1);
    await navigate('/dispatch/zones');
    await screen.findByRole('cell', { name: 'Workflow zone' });
    expect((await readDated()).zones[0]?.statusCounts).toEqual({ Assigned: 1 });
    expect(
      reads.filter((path) => path.includes('/zones/summary?')),
    ).toHaveLength(3);
    expect(writes).toHaveLength(2);
    expect(writes[0]?.key).toBeTruthy();
    expect(writes[1]?.key).not.toBe(writes[0]?.key);
    expect(JSON.parse(writes[0]!.body)).toMatchObject({
      courierId: courierA,
      expectedVersion: 1,
      serviceDate: '2026-11-14',
    });
    expect(JSON.parse(writes[1]!.body)).toMatchObject({
      courierId: courierB,
      expectedVersion: 2,
      reassign: true,
      reason: 'Replacement needed',
    });
    for (const key of unrelatedKeys) {
      expect(queries.getQueryState(key)?.isInvalidated).toBe(false);
      expect(queries.getQueryData(key)).toEqual({ sentinel: true });
    }

    async function workload(countA: number, countB: number) {
      await navigate('/dispatch/workload');
      await waitFor(() => {
        const row = screen.getByText('Courier Alpha').closest('tr')!;
        expect(within(row).getAllByRole('cell')[4]).toHaveTextContent(
          String(countA),
        );
      });
      for (const [code, count] of [
        ['COU-0001', countA],
        ['COU-0002', countB],
      ] as const) {
        const row = screen.getByText(code).closest('tr')!;
        expect(within(row).getAllByRole('cell')[4]).toHaveTextContent(
          String(count),
        );
        await user.click(
          screen.getByRole('button', {
            name: `View active parcels for ${code}`,
          }),
        );
        if (count)
          await screen.findByRole('link', {
            name: `View details for ${parcel.trackingNumber}`,
          });
        else await screen.findByText('No active assignments');
        await user.click(screen.getByRole('button', { name: 'Close' }));
      }
    }
    async function dashboard(countA: number, countB: number) {
      await navigate('/dashboard');
      await screen.findByText('No parcels awaiting assignment');
      expect(screen.getByLabelText('Awaiting assignment')).toHaveTextContent(
        '0',
      );
      expect(screen.getByLabelText('In progress')).toHaveTextContent('1');
      expect(screen.getByLabelText('Zones with backlog')).toHaveTextContent(
        '0',
      );
      for (const [name, count] of [
        ['Courier Alpha', countA],
        ['Courier Beta', countB],
      ] as const) {
        expect(screen.getByText(name).closest('li')).toHaveTextContent(
          `${count} / 2`,
        );
      }
    }
  },
);
