import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { RouteAccessBoundary, safeReturnTo } from './route-access';
import type { Profile } from './contracts';
import { customer } from './test-fixtures';

let user: Profile | null = null;
vi.mock('./session', () => ({
  useIdentity: () => ({ user, restoring: false }),
}));
afterEach(() => {
  user = null;
});
const cases: { path: string; allowed: Profile['roles'] }[] = [
  { path: '/admin/users', allowed: ['Admin'] },
  { path: '/admin/audit', allowed: ['Admin'] },
  { path: '/admin/merchants', allowed: ['Admin'] },
  { path: '/admin/zones', allowed: ['Admin'] },
  { path: '/admin/pricing', allowed: ['Admin'] },
  { path: '/admin/reports', allowed: ['Admin'] },
  { path: '/customer/book', allowed: ['Customer'] },
  { path: '/customer/parcels/123/receipt', allowed: ['Customer'] },
  { path: '/customer/history', allowed: ['Customer'] },
  { path: '/customer/tracking', allowed: ['Customer'] },
  { path: '/customer/receipts', allowed: ['Customer'] },
  { path: '/courier', allowed: ['Courier'] },
  { path: '/courier/history', allowed: ['Courier'] },
  { path: '/courier/parcels/123', allowed: ['Courier'] },
  { path: '/dispatch/zones', allowed: ['Admin', 'Dispatcher'] },
  { path: '/dispatch/unassigned', allowed: ['Admin', 'Dispatcher'] },
  { path: '/dispatch/parcels', allowed: ['Admin', 'Dispatcher'] },
  { path: '/dispatch/parcels/123', allowed: ['Admin', 'Dispatcher'] },
  { path: '/dispatch/parcels/123/receipt', allowed: ['Admin'] },
  { path: '/merchant/webhooks', allowed: ['Merchant'] },
  {
    path: '/merchant',
    allowed: ['Customer', 'Courier', 'Merchant', 'Dispatcher', 'Admin'],
  },
  {
    path: '/profile',
    allowed: ['Customer', 'Courier', 'Merchant', 'Dispatcher', 'Admin'],
  },
  {
    path: '/dashboard',
    allowed: ['Customer', 'Courier', 'Merchant', 'Dispatcher', 'Admin'],
  },
];

function mount(path: string) {
  const privateMount = vi.fn();
  function PrivatePage() {
    privateMount();
    return <h1>Protected content</h1>;
  }
  const router = createMemoryRouter(
    [
      {
        element: (
          <RouteAccessBoundary>
            <Outlet />
          </RouteAccessBoundary>
        ),
        children: [{ path, element: <PrivatePage /> }],
      },
      { path: '/401', element: <h1>401</h1> },
      { path: '/403', element: <h1>403</h1> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return { router, privateMount };
}

describe('Direct URL access policy', () => {
  for (const role of [
    'Customer',
    'Courier',
    'Merchant',
    'Dispatcher',
    'Admin',
  ] as const) {
    it.each(cases)(
      `${role} access to $path matches the agreed role policy`,
      async ({ path, allowed }) => {
        user = { ...customer, roles: [role] };
        const { router, privateMount } = mount(path);
        await screen.findByRole('heading', {
          name: allowed.includes(role) ? 'Protected content' : '403',
        });
        expect(router.state.location.pathname).toBe(
          allowed.includes(role) ? path : '/403',
        );
        if (!allowed.includes(role))
          expect(privateMount).not.toHaveBeenCalled();
      },
    );
  }
  it.each(cases)(
    'shows 401 before mounting protected $path for signed-out visitors',
    async ({ path }) => {
      const { router, privateMount } = mount(path);
      await screen.findByRole('heading', { name: '401' });
      expect(router.state.location.state).toEqual({ returnTo: path });
      expect(privateMount).not.toHaveBeenCalled();
    },
  );
  it('combines roles while retaining Customer-only booking', async () => {
    user = { ...customer, roles: ['Courier', 'Customer'] };
    mount('/customer/book');
    await screen.findByRole('heading', { name: 'Protected content' });
  });
  it.each([
    'https://example.test',
    '//example.test',
    '/\\example.test',
    '/login',
    '/401',
    '/unknown',
    null,
  ])('rejects unsafe or looping sign-in return paths: %s', (value) => {
    expect(safeReturnTo(value)).toBe('/dashboard');
  });
  it('retains a protected destination, query and fragment after sign-in', () => {
    expect(safeReturnTo('/dispatch/unassigned')).toBe('/dispatch/unassigned');
    expect(safeReturnTo('/customer/history?search=TRK#parcel')).toBe(
      '/customer/history?search=TRK#parcel',
    );
  });
});
