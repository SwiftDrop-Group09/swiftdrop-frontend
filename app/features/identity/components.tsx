import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import { IdentityError } from './api';
import { useIdentity } from './session';

export function safeError(error: unknown) {
  return error instanceof IdentityError
    ? error.message
    : 'The request could not be completed. Please try again.';
}
export function IdentityShell({ children }: { children: ReactNode }) {
  const { user } = useIdentity();
  return (
    <div className="identity-app">
      <header>
        <Link className="brand" to="/">
          SwiftDrop
        </Link>
        <nav aria-label="Account navigation">
          {user ? (
            <>
              <Link to="/profile">My profile</Link>
              {user.roles.includes('Admin') && (
                <Link to="/admin/users">User administration</Link>
              )}
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>
      <main>{children}</main>
      <footer>SwiftDrop account services</footer>
    </div>
  );
}
export function Protected({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { user, restoring, error } = useIdentity();
  if (restoring) return <p role="status">Restoring your session…</p>;
  if (!user)
    return error ? (
      <>
        <p role="alert">{error}</p>
        <Link to="/login">Sign in</Link>
      </>
    ) : (
      <Navigate to="/login" replace />
    );
  if (admin && !user.roles.includes('Admin'))
    return (
      <p role="alert">
        You do not have permission to view user administration.
      </p>
    );
  return children;
}
export function FieldError({ message }: { message?: string }) {
  return message ? (
    <span role="alert" className="field-error">
      {message}
    </span>
  ) : null;
}
