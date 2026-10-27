import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('portals/public/index.tsx'),
  route('customer/book', 'portals/customer/booking.tsx'),
  route('*', 'portals/public/not-found.tsx'),
] satisfies RouteConfig;
