import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportsPage from '~/portals/admin/reports';
import { deliveryReportCsv } from './report-export';
const mocks = vi.hoisted(() => ({
  request: vi.fn<typeof fetch>(),
  role: 'Admin',
}));
vi.mock('~/features/identity/session', () => ({
  useIdentity: () => ({
    restoring: false,
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: 'Administrator',
      email: 'admin@example.test',
      roles: [mocks.role],
      isActive: true,
      phoneNumber: null,
      address: null,
    },
    session: { api: { base: '/api' }, authenticatedRequest: mocks.request },
  }),
}));
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
function fixture(input: RequestInfo | URL) {
  const query = url(input).searchParams;
  const from = query.get('from')!,
    to = query.get('to')!;
  const days = [];
  for (
    const day = new Date(from);
    day < new Date(to);
    day.setUTCDate(day.getUTCDate() + 1)
  )
    days.push({
      date: day.toISOString().slice(0, 10),
      delivered: 3,
      failed: 1,
      cancelled: 1,
    });
  return {
    from,
    to,
    delivered: days.length * 3,
    failed: days.length,
    cancelled: days.length,
    terminalCount: days.length * 4,
    successRate: 0.75,
    failureRate: 0.25,
    days,
  };
}
beforeEach(() => {
  mocks.role = 'Admin';
  mocks.request.mockReset();
  mocks.request.mockImplementation((input) =>
    Promise.resolve(Response.json(fixture(input))),
  );
});
function mount() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/admin/reports']}>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return user;
}
describe('Delivery reports workspace', () => {
  it('uses the shared shell, explicit UTC application and no duplicate admin navigation', async () => {
    const user = mount();
    await screen.findByText('Daily breakdown');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Delivery reports',
    );
    expect(
      screen.queryByRole('navigation', { name: 'Admin Navigation' }),
    ).not.toBeInTheDocument();
    const count = mocks.request.mock.calls.length;
    await user.clear(screen.getByLabelText('From (UTC)'));
    await user.type(screen.getByLabelText('From (UTC)'), '2026-11-01');
    await user.clear(screen.getByLabelText('Through (UTC)'));
    await user.type(screen.getByLabelText('Through (UTC)'), '2026-11-02');
    expect(mocks.request).toHaveBeenCalledTimes(count);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Apply dates' }));
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.some(
          ([input]) =>
            url(input).searchParams.get('from') ===
              '2026-11-01T00:00:00.000Z' &&
            url(input).searchParams.get('to') === '2026-11-03T00:00:00.000Z',
        ),
      ).toBe(true),
    );
    expect(await screen.findByText('2 days')).toBeInTheDocument();
  });
  it('rejects reversed and oversized periods without replacing the current report', async () => {
    const user = mount();
    await screen.findByText('Daily breakdown');
    const count = mocks.request.mock.calls.length;
    await user.clear(screen.getByLabelText('From (UTC)'));
    await user.type(screen.getByLabelText('From (UTC)'), '2026-11-20');
    await user.clear(screen.getByLabelText('Through (UTC)'));
    await user.type(screen.getByLabelText('Through (UTC)'), '2026-11-01');
    await user.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(screen.getByText('Invalid reporting period')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('From (UTC)'));
    await user.type(screen.getByLabelText('From (UTC)'), '2024-01-01');
    await user.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(screen.getByText('Invalid reporting period')).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledTimes(count);
    expect(screen.getByText('Daily breakdown')).toBeInTheDocument();
  });
  it('paginates complete daily results without another network request and preserves rate denominators', async () => {
    const user = mount();
    await screen.findByText('Daily breakdown');
    await user.click(screen.getByRole('button', { name: 'Last 30 days' }));
    await screen.findByText('30 days');
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getAllByText('75.0%').length).toBeGreaterThan(1);
    const count = mocks.request.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Next days' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledTimes(count);
    expect(screen.getAllByRole('row')).toHaveLength(11);
  });
  it('keeps failures visible and retries reads without fabricated zero summaries', async () => {
    mocks.request.mockResolvedValueOnce(
      Response.json({ code: 'delivery_unavailable' }, { status: 503 }),
    );
    const user = mount();
    await screen.findByText('Unable to load delivery report');
    expect(screen.queryByText('Daily breakdown')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Daily breakdown');
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });
  it('exports every day with cancellation excluded from success/failure denominators', () => {
    const csv = deliveryReportCsv({
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-03T00:00:00Z',
      delivered: 3,
      failed: 1,
      cancelled: 11,
      terminalCount: 4,
      successRate: 0.75,
      failureRate: 0.25,
      days: [
        { date: '2026-11-01', delivered: 3, failed: 1, cancelled: 10 },
        { date: '2026-11-02', delivered: 0, failed: 0, cancelled: 1 },
      ],
    });
    expect(csv).toContain('2026-11-01,3,1,10,4,75.00%,25.00%');
    expect(csv).toContain('2026-11-02,0,0,1,0,0.00%,0.00%');
    expect(csv.split('\r\n')).toHaveLength(3);
  });
  it.each(['Customer', 'Courier', 'Merchant', 'Dispatcher'])(
    'blocks %s before report requests mount',
    (role) => {
      mocks.role = role;
      mount();
      expect(mocks.request).not.toHaveBeenCalled();
    },
  );
});
