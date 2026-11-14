import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardRoute from '~/portals/customer/dashboard';
import AdminDashboard from './admin-dashboard';
import { metricComparison, zoneWorkloads } from './analytics';
import {
  getPreviousReportRange,
  getUtcDatePreset,
  getUtcIsoRange,
} from '~/features/admin-delivery/report-date-range';

const mocks = vi.hoisted(() => ({
  request: vi.fn<typeof fetch>(),
  role: 'Admin',
  userId: '00000000-0000-4000-8000-000000000001',
}));
vi.mock('~/features/identity/session', () => ({
  useIdentity: () => ({
    restoring: false,
    user: {
      id: mocks.userId,
      fullName: 'Administrator',
      email: 'admin@example.test',
      roles: [mocks.role],
      isActive: true,
      phoneNumber: null,
      address: null,
    },
    session: {
      api: { base: '/custom-api' },
      authenticatedRequest: mocks.request,
    },
  }),
}));
const zoneId = '00000000-0000-4000-8000-000000000002';
const todayRange = getUtcDatePreset(30);
const defaultFrom = getUtcIsoRange(
  todayRange.startDate,
  todayRange.endDate,
).fromUtc!;
function url(input: RequestInfo | URL) {
  return new URL(
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    'https://example.test',
  );
}
function response(input: RequestInfo | URL) {
  const request = url(input);
  if (request.pathname.endsWith('/zones/summary'))
    return Response.json({
      zones: [
        {
          zoneId,
          name: 'Colombo Central',
          total: 61,
          statusCounts: {
            Created: 3,
            Assigned: 2,
            PickedUp: 1,
            Delivered: 50,
            Failed: 4,
            Cancelled: 1,
          },
        },
      ],
    });
  if (request.pathname.endsWith('/merchants'))
    return Response.json([
      {
        id: '00000000-0000-4000-8000-000000000003',
        userId: mocks.userId,
        businessName: 'Kandy Tea Company',
        contactEmail: 'hello@example.test',
        contactPhone: '+94770000000',
        pickupAddress: 'Kandy',
        status: 'Pending',
        registeredAt: '2026-11-12T00:00:00Z',
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        userId: mocks.userId,
        businessName: 'Colombo Textiles',
        contactEmail: 'hello@example.test',
        contactPhone: '+94770000001',
        pickupAddress: 'Colombo',
        status: 'Approved',
        registeredAt: '2026-11-10T00:00:00Z',
      },
    ]);
  const from = request.searchParams.get('from')!,
    to = request.searchParams.get('to')!;
  const previous = new Date(from) < new Date(defaultFrom);
  const days = [];
  for (
    const day = new Date(from);
    day < new Date(to);
    day.setUTCDate(day.getUTCDate() + 1)
  )
    days.push({
      date: day.toISOString().slice(0, 10),
      delivered: previous ? 1 : 3,
      failed: 1,
      cancelled: previous ? 0 : 1,
    });
  return Response.json({
    from,
    to,
    delivered: days.length * (previous ? 1 : 3),
    failed: days.length,
    cancelled: previous ? 0 : days.length,
    terminalCount: days.length * (previous ? 2 : 4),
    successRate: previous ? 0.5 : 0.75,
    failureRate: previous ? 0.5 : 0.25,
    days,
  });
}
beforeEach(() => {
  mocks.role = 'Admin';
  mocks.userId = '00000000-0000-4000-8000-000000000001';
  mocks.request.mockReset();
  mocks.request.mockImplementation((input) => Promise.resolve(response(input)));
});
function mount(
  direct = false,
  queries = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queries}>
      <MemoryRouter initialEntries={['/dashboard']}>
        {direct ? <AdminDashboard /> : <DashboardRoute />}
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { user, queries, ...view };
}
describe('Admin operations dashboard', () => {
  it('keeps definitions in accessible shadcn info tooltips instead of page copy', async () => {
    const { user } = mount();
    await screen.findByText('+25.0 pp');
    expect(
      screen.queryByText('Terminal outcomes = delivered + failed.'),
    ).not.toBeInTheDocument();
    await user.hover(
      screen.getByRole('button', { name: 'About Success rate' }),
    );
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Cancellations are excluded',
    );
    await user.keyboard('{Escape}');
    await user.unhover(
      screen.getByRole('button', { name: 'About Success rate' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument(),
    );
    await user.hover(
      screen.getByRole('button', { name: 'About zone workload' }),
    );
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'independent of the reporting period',
    );
  });
  it('reaches the rich dashboard through the actual route with 30-day comparisons and real charts', async () => {
    mount();
    expect(
      await screen.findByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('+25.0 pp')).toBeInTheDocument();
    expect(screen.getByText('+200.0%')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Daily delivery outcomes chart' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Delivery outcome breakdown chart' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('region', {
        name: 'Current zone workload chart',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Kandy Tea Company')).toBeInTheDocument();
    expect(screen.queryByText('Colombo Textiles')).not.toBeInTheDocument();
    expect(mocks.request.mock.calls).toHaveLength(4);
    expect(
      mocks.request.mock.calls.every(([input]) =>
        url(input).pathname.startsWith('/custom-api/v1/'),
      ),
    ).toBe(true);
    const dates = mocks.request.mock.calls
      .filter(([input]) => url(input).pathname.endsWith('/reports/deliveries'))
      .map(([input]) => url(input));
    expect(
      dates.map(
        (value) =>
          (Date.parse(value.searchParams.get('to')!) -
            Date.parse(value.searchParams.get('from')!)) /
          86400000,
      ),
    ).toEqual([30, 30]);
    expect(dates[1]!.searchParams.get('to')).toBe(
      dates[0]!.searchParams.get('from'),
    );
    expect(
      screen.getByRole('link', { name: 'View delivery report' }),
    ).toHaveAttribute(
      'href',
      `/admin/reports?from=${todayRange.startDate}&through=${todayRange.endDate}`,
    );
  });
  it('changes only period-bound reads through the compact date popover', async () => {
    const { user } = mount();
    await screen.findByText('+25.0 pp');
    await user.click(screen.getByRole('button', { name: 'Reporting period' }));
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.filter(([input]) =>
          url(input).pathname.endsWith('/reports/deliveries'),
        ),
      ).toHaveLength(4),
    );
    expect(
      mocks.request.mock.calls.filter(([input]) =>
        url(input).pathname.endsWith('/zones/summary'),
      ),
    ).toHaveLength(1);
    expect(
      mocks.request.mock.calls.filter(([input]) =>
        url(input).pathname.endsWith('/merchants'),
      ),
    ).toHaveLength(1);
    expect(screen.queryByLabelText('From (UTC)')).not.toBeInTheDocument();
  });
  it('shows independent failures and does not substitute an unavailable comparison or approval count', async () => {
    mocks.request.mockImplementation((input) => {
      const request = url(input);
      return Promise.resolve(
        request.pathname.endsWith('/merchants') ||
          request.searchParams.get('to') === defaultFrom
          ? Response.json({ code: 'delivery_unavailable' }, { status: 503 })
          : response(input),
      );
    });
    mount();
    expect(
      await screen.findByText('Previous-period comparison unavailable'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Merchant approvals unavailable'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Daily delivery outcomes chart' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Current zone workload chart' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Comparison unavailable')).toHaveLength(6);
    expect(
      screen.queryByText('No merchant applications awaiting review.'),
    ).not.toBeInTheDocument();
  });
  it('keeps operations snapshots available when current delivery reporting fails', async () => {
    mocks.request.mockImplementation((input) =>
      Promise.resolve(
        url(input).searchParams.get('from') === defaultFrom
          ? Response.json({ code: 'delivery_unavailable' }, { status: 503 })
          : response(input),
      ),
    );
    mount();
    expect(
      await screen.findByText('Delivery performance unavailable'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Kandy Tea Company')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Daily delivery outcomes chart' }),
    ).not.toBeInTheDocument();
  });
  it('keeps private cached dashboard values scoped to their authenticated user', async () => {
    const queries = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const first = mount(false, queries);
    await screen.findByText('Kandy Tea Company');
    first.unmount();
    mocks.userId = '00000000-0000-4000-8000-000000000099';
    mocks.request.mockResolvedValue(
      Response.json({ code: 'forbidden' }, { status: 403 }),
    );
    mount(false, queries);
    expect(screen.queryByText('Kandy Tea Company')).not.toBeInTheDocument();
    await screen.findByText('Merchant approvals unavailable');
  });
  it.each(['Customer', 'Courier', 'Merchant', 'Dispatcher'])(
    'blocks %s before Admin private reads',
    (role) => {
      mocks.role = role;
      mount(true);
      expect(mocks.request).not.toHaveBeenCalled();
    },
  );
});
describe('Dashboard period and metric semantics', () => {
  it('calculates adjacent equal UTC periods across leap dates and year boundaries', () => {
    expect(getPreviousReportRange('2024-02-28', '2024-03-01')).toEqual({
      fromUtc: '2024-02-25T00:00:00.000Z',
      toUtc: '2024-02-28T00:00:00.000Z',
    });
    expect(getPreviousReportRange('2026-01-01', '2026-01-01')).toEqual({
      fromUtc: '2025-12-31T00:00:00.000Z',
      toUtc: '2026-01-01T00:00:00.000Z',
    });
    expect(getPreviousReportRange('bad', '2026-01-01')).toBeNull();
  });
  it('distinguishes percent changes, percentage points and zero baselines', () => {
    expect(metricComparison(90, 30).label).toBe('+200.0%');
    expect(metricComparison(0.75, 0.5, true).label).toBe('+25.0 pp');
    expect(metricComparison(5, 0).label).toBe('New activity');
    expect(metricComparison(0, 0).label).toBe('No change');
    expect(metricComparison(0, 10).label).toBe('-100.0%');
  });
  it('excludes terminal and unknown statuses from current workload totals', () => {
    expect(
      zoneWorkloads([
        {
          zoneId,
          name: 'Colombo',
          total: 56,
          statusCounts: {
            Created: 2,
            Assigned: 3,
            Delivered: 40,
            Failed: 10,
            Unexpected: 1,
          },
        },
      ])[0],
    ).toMatchObject({ active: 3, awaiting: 2 });
  });
});
