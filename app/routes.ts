import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('portals/public/index.tsx'),
  route('login', 'portals/auth/login.tsx'),
  route('register', 'portals/auth/register.tsx'),
  route('signup', 'portals/auth/signup.tsx'),
  route('dashboard', 'portals/customer/dashboard.tsx'),
  route('profile', 'portals/customer/profile.tsx'),
  route('merchant', 'portals/merchant/index.tsx'),
  route('merchant/webhooks', 'portals/merchant/webhooks.tsx'),
  route('admin/users', 'portals/admin/users.tsx'),
  route('admin/zones', 'portals/admin/zones.tsx'),
  route('admin/pricing', 'portals/admin/pricing.tsx'),
  route('admin/reports', 'portals/admin/reports.tsx'),
  route('admin/merchants', 'portals/admin/merchants.tsx'),
  route('courier', 'portals/courier/layout.tsx', [
    index('portals/courier/manifest.tsx'),
    route('parcels/:id', 'portals/courier/details.tsx'),
    route('history', 'portals/courier/history.tsx'),
  ]),
  route('customer/book', 'portals/customer/booking.tsx'),
  route('customer/tracking', 'portals/customer/tracking.tsx'),
  route('customer/history', 'portals/customer/history.tsx'),
  route('customer/receipts', 'portals/customer/receipt.tsx'),
  route('customer/parcels/:id', 'portals/customer/tracking.tsx', {
    id: 'customer-parcel-detail',
  }),
  route('customer/parcels/:id/receipt', 'portals/customer/receipt.tsx', {
    id: 'customer-parcel-receipt',
  }),
  route('track', 'portals/public/track.tsx'),
  route('*', 'portals/public/not-found.tsx'),
] satisfies RouteConfig;
