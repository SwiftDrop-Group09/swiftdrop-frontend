import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessPage } from './access-page';
import { Route, Routes, MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { CustomerDashboardWorkspace } from '~/features/customer-tracking/dashboard-page';
import { OrderHistoryPage } from '~/features/customer-tracking/history-page';
import { CustomerTrackingPage } from '~/features/customer-tracking/tracking-page';
import { CustomerReceiptPage } from '~/features/customer-tracking/receipt-page';
import { CustomerBookingWorkspace } from '~/features/customer-booking/workspace';
import { ZoneSummaryPage } from '~/features/dispatch/zone-summary-page';
import { IdentityApi } from './api';
import { IdentityProvider, IdentitySession } from './session';
import type { Profile } from './contracts';
import { customer, csrf, json, pair } from './test-fixtures';

const matchMedia = window.matchMedia.bind(window);
beforeEach(() => vi.stubGlobal('matchMedia', matchMedia));
afterEach(() => vi.unstubAllGlobals());

function mount(role: Profile['roles'][number], path: string, page: ReactNode) {
  const privateReads = vi.fn();
  const fetcher = vi.fn<typeof fetch>((input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.endsWith('/auth/csrf')) return Promise.resolve(json(csrf));
    if (url.endsWith('/auth/refresh'))
      return Promise.resolve(json(pair({ ...customer, roles: [role] })));
    privateReads(url);
    if (url.endsWith('/zones/summary'))
      return Promise.resolve(json({ zones: [] }));
    return Promise.resolve(json({ code: 'not_found' }, 404));
  });
  vi.stubGlobal('fetch', fetcher);
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = new IdentitySession(new IdentityApi(fetcher), () =>
    queries.clear(),
  );
  render(
    <QueryClientProvider client={queries}>
      <IdentityProvider session={session}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={path} element={page} />
            <Route path="/403" element={<AccessPage status={403} />} />
          </Routes>
        </MemoryRouter>
      </IdentityProvider>
    </QueryClientProvider>,
  );
  return privateReads;
}

describe('Role-aware workspaces', () => {
  it.each(['Courier', 'Merchant', 'Dispatcher', 'Admin'] as const)(
    'does not request Customer data on a %s dashboard',
    async (role) => {
      const reads = mount(role, '/dashboard', <CustomerDashboardWorkspace />);
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
      if (role === 'Admin') {
        expect(
          reads.mock.calls.every(
            ([path]) =>
              !String(path).includes('/parcels/me') &&
              !String(path).includes('/customer/'),
          ),
        ).toBe(true);
      } else expect(reads).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('link', { name: 'Book a Delivery' }),
      ).not.toBeInTheDocument();
    },
  );
  it.each([
    { path: '/customer/history', Page: OrderHistoryPage },
    { path: '/customer/tracking', Page: CustomerTrackingPage },
    { path: '/customer/receipts', Page: CustomerReceiptPage },
    { path: '/customer/book', Page: CustomerBookingWorkspace },
  ])(
    'blocks an Admin-only account from Customer route $path before private reads',
    async ({ path, Page }) => {
      const reads = mount('Admin', path, <Page />);
      await screen.findByRole(
        'heading',
        { name: 'Access denied' },
        { timeout: 5000 },
      );
      expect(reads).not.toHaveBeenCalled();
    },
  );
  it.each(['Customer', 'Courier', 'Merchant', 'Dispatcher', 'Admin'] as const)(
    'enforces the zone-summary policy for %s',
    async (role) => {
      const reads = mount(role, '/dispatch/zones', <ZoneSummaryPage />);
      if (role === 'Dispatcher' || role === 'Admin') {
        await screen.findByText('No zone activity yet');
        await waitFor(() => expect(reads).toHaveBeenCalledTimes(1));
      } else {
        await screen.findByRole('heading', { name: 'Access denied' });
        expect(reads).not.toHaveBeenCalled();
      }
    },
  );
});
