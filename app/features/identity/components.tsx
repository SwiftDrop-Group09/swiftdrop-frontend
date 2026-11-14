import { BrandLogo } from '~/shared/components/brand-logo';
import { Button } from '~/shared/components/ui/button';
import { FieldError as ShadcnFieldError } from '~/shared/components/ui/field';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { IdentityError } from './api';
import { useIdentity } from './session';
import { DashboardShell } from './dashboard-shell';
import { AccessGate } from './route-access';
import type { Profile } from './contracts';

export function safeError(error: unknown) {
  return error instanceof IdentityError
    ? error.message
    : 'The request could not be completed. Please try again.';
}
export function IdentityShell({ children }: { children: ReactNode }) {
  const { user } = useIdentity();
  if (user) return <DashboardShell>{children}</DashboardShell>;
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link className="text-xl font-semibold tracking-tight" to="/">
            <BrandLogo />
          </Link>
          <nav
            className="flex flex-wrap items-center gap-1"
            aria-label="Account navigation"
          >
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/register">Register</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
      <footer className="border-t px-4 py-5 text-center text-xs text-muted-foreground">
        SwiftDrop account services
      </footer>
    </div>
  );
}
export function Protected({
  children,
  admin = false,
  roles,
}: {
  children: ReactNode;
  admin?: boolean;
  roles?: readonly Profile['roles'][number][];
}) {
  return <AccessGate roles={admin ? ['Admin'] : roles}>{children}</AccessGate>;
}

export function FieldError({ message }: { message?: string }) {
  return message ? <ShadcnFieldError>{message}</ShadcnFieldError> : null;
}
