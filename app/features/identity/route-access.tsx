import { AppLoading } from '~/shared/components/app-loading';
import type { ReactNode } from 'react';
import { matchPath, Navigate, useLocation } from 'react-router';
import type { Profile } from './contracts';
import { useIdentity } from './session';

type Role = Profile['roles'][number];
export const routePermissions: readonly {
  path: string;
  roles?: readonly Role[];
}[] = [
  ...['/dashboard', '/profile', '/merchant'].map((path) => ({ path })),
  ...[
    '/merchant/webhooks',
    '/merchant/overview',
    '/merchant/orders',
    '/merchant/orders/:id',
  ].map((path) => ({ path, roles: ['Merchant'] as const })),
  ...['users', 'audit', 'merchants', 'zones', 'pricing', 'reports'].map(
    (page) => ({ path: `/admin/${page}`, roles: ['Admin'] as const }),
  ),
  ...['zones', 'parcels', 'parcels/:id'].map((page) => ({
    path: `/dispatch/${page}`,
    roles: ['Dispatcher', 'Admin'] as const,
  })),
  { path: '/dispatch/parcels/:id/receipt', roles: ['Admin'] },
  ...['/courier', '/courier/history', '/courier/parcels/:id'].map((path) => ({
    path,
    roles: ['Courier'] as const,
  })),
  ...[
    'book',
    'tracking',
    'history',
    'receipts',
    'parcels/:id',
    'parcels/:id/receipt',
  ].map((page) => ({
    path: `/customer/${page}`,
    roles: ['Customer'] as const,
  })),
];

export function safeReturnTo(value: unknown) {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\r\n]/.test(value) &&
    routePermissions.some(({ path }) =>
      matchPath(path, value.split(/[?#]/)[0] ?? ''),
    )
    ? value
    : '/dashboard';
}

export function AccessGate({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: readonly Role[];
}) {
  const { user, restoring } = useIdentity();
  const location = useLocation();
  if (restoring) return <AppLoading />;
  if (!user)
    return (
      <Navigate
        to="/401"
        replace
        state={{
          returnTo: location.pathname + location.search + location.hash,
        }}
      />
    );
  if (roles && !roles.some((role) => user.roles.includes(role)))
    return <Navigate to="/403" replace />;
  return children;
}

export function RouteAccessBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const permission = routePermissions.find(({ path }) =>
    matchPath(path, pathname),
  );
  return permission ? (
    <AccessGate roles={permission.roles}>{children}</AccessGate>
  ) : (
    children
  );
}
