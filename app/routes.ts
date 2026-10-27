import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('portals/public/index.tsx'),
  route('login', 'portals/auth/login.tsx'),
  route('register', 'portals/auth/register.tsx'),
  route('profile', 'portals/customer/profile.tsx'),
  route('admin/users', 'portals/admin/users.tsx'),
  route('*', 'portals/public/not-found.tsx'),
] satisfies RouteConfig;
