import { LoaderCircle } from 'lucide-react';
import { Navigate } from 'react-router';
import { useIdentity } from './session';

export function SessionEntry({ register = false }: { register?: boolean }) {
  const { user, restoring } = useIdentity();
  if (restoring) {
    return (
      <main className="flex min-h-svh items-center justify-center px-6">
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Checking your session...
        </p>
      </main>
    );
  }
  return (
    <Navigate
      to={user ? '/dashboard' : register ? '/register' : '/login'}
      replace
    />
  );
}
