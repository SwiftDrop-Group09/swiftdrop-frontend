import { afterEach, vi } from 'vitest';
import { render, screen, type Matcher } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { IdentityApi } from '../identity/api';
import { IdentityProvider, IdentitySession } from '../identity/session';
import { csrf, customer, json, pair } from '../identity/test-fixtures';
import type { BusinessResponse } from '../merchant/contracts';
import { DashboardPage } from './dashboard-page';
import { OrderDetailPage } from './order-detail-page';
import { OrdersPage } from './orders-page';

/** Shared mount for merchant order/dashboard page tests: a signed-in Merchant with a fake backend. */

export const merchantUser = {
  ...customer,
  roles: ['Merchant'] as (
    'Customer' | 'Courier' | 'Merchant' | 'Dispatcher' | 'Admin'
  )[],
};

export const approvedBusiness: BusinessResponse = {
  id: '99999999-9999-4999-8999-999999999999',
  userId: merchantUser.id,
  businessName: 'Fictional Traders',
  contactEmail: 'ops@fictional.test',
  contactPhone: '+94 77 000 0000',
  pickupAddress: '1 Fictional Road, Colombo',
  status: 'Approved',
  rejectionReason: null,
  registeredAt: '2026-11-05T10:00:00Z',
  approvedAt: '2026-11-05T12:00:00Z',
  approvedBy: 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa',
};

/** Answers a request, or returns undefined to fall through to the defaults. */
export type Handler = (url: string) => Response | undefined;

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Every page waits for session restore, then the business check, then its own
 * data. Allow for that chain on a busy CI machine instead of the 1 s default.
 */
const PAGE_LOAD_TIMEOUT_MS = 5_000;
export const findText = (text: Matcher) =>
  screen.findByText(text, undefined, { timeout: PAGE_LOAD_TIMEOUT_MS });

export function urlOf(input: Parameters<typeof fetch>[0]): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

export function mount(
  path: string,
  handler?: Handler,
  business: BusinessResponse | null = approvedBusiness,
) {
  const fetcher = vi.fn<typeof fetch>((input) => {
    const url = urlOf(input);
    const custom = handler?.(url);
    if (custom) return Promise.resolve(custom);
    if (url.endsWith('/auth/csrf')) return Promise.resolve(json(csrf));
    if (url.endsWith('/auth/refresh'))
      return Promise.resolve(json(pair(merchantUser)));
    if (url.endsWith('/users/me')) return Promise.resolve(json(merchantUser));
    if (url.endsWith('/v1/merchants/me')) {
      return Promise.resolve(
        business ? json(business) : json({ code: 'business_not_found' }, 404),
      );
    }
    return Promise.resolve(json({ code: 'not_found' }, 404));
  });
  vi.stubGlobal('fetch', fetcher);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = new IdentitySession(new IdentityApi(fetcher), () =>
    queryClient.clear(),
  );
  const router = createMemoryRouter(
    [
      { path: '/merchant/overview', element: <DashboardPage /> },
      { path: '/merchant/orders', element: <OrdersPage /> },
      { path: '/merchant/orders/:id', element: <OrderDetailPage /> },
      { path: '/track', element: <h1>Public tracking</h1> },
      { path: '/merchant', element: <h1>Business registration</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <IdentityProvider session={session}>
        <RouterProvider router={router} />
      </IdentityProvider>
    </QueryClientProvider>,
  );
  return { fetcher, router };
}

export type Fetcher = ReturnType<typeof mount>['fetcher'];

export const requestedUrls = (fetcher: Fetcher) =>
  fetcher.mock.calls.map(([input]) => urlOf(input));
