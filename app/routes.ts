import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('portals/public/index.tsx'),
  route('login', 'portals/auth/login.tsx'),
  route('register', 'portals/auth/register.tsx'),
  route('signup', 'portals/auth/signup.tsx'),
  route('dashboard', 'portals/customer/dashboard.tsx'),
  route('profile', 'portals/customer/profile.tsx'),
  route('admin/users', 'portals/admin/users.tsx'),
  route('admin/zones', 'portals/admin/zones.tsx'),
  route('admin/pricing', 'portals/admin/pricing.tsx'),
  route('admin/reports', 'portals/admin/reports.tsx'),
  route('courier', 'portals/courier/layout.tsx', [
    index('portals/courier/manifest.tsx'),
    route('parcels/:id', 'portals/courier/details.tsx'),
    route('history', 'portals/courier/history.tsx'),
  ]),
  route('customer/book', 'portals/customer/booking.tsx'),
  route('*', 'portals/public/not-found.tsx'),
] satisfies RouteConfig;
