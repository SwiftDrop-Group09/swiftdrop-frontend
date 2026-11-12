import type { ReactNode } from 'react';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from 'react-router';
import { AppProviders } from './providers';
import { IdentityProvider } from './features/identity/session';
import './styles/app.css';
import { ThemeController } from './shared/theme';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
        <script src="/theme.js" />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export const meta = () => [{ title: 'SwiftDrop' }];

export function HydrateFallback() {
  return <p role="status">Loading…</p>;
}

export default function App() {
  return (
    <AppProviders>
      <ThemeController />
      <IdentityProvider>
        <Outlet />
      </IdentityProvider>
    </AppProviders>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <p role="alert">Page not found.</p>;
  }
  return <p role="alert">Unable to load the application. Please reload.</p>;
}
