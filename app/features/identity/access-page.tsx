import { LockKeyhole, ShieldX } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { IdentityShell } from './components';
import { useIdentity } from './session';
import { safeReturnTo } from './route-access';
import { Button } from '~/shared/components/ui/button';
import { Card, CardContent } from '~/shared/components/ui/card';

export function AccessPage({ status }: { status: 401 | 403 }) {
  const { user, error } = useIdentity();
  const location = useLocation();
  const returnTo = safeReturnTo(
    (location.state as { returnTo?: unknown } | null)?.returnTo,
  );
  const Icon = status === 401 ? LockKeyhole : ShieldX;
  return (
    <IdentityShell>
      <Card className="mx-auto w-full max-w-xl">
        <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-10">
          <div className="rounded-full bg-muted p-4">
            <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{status}</p>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {status === 401 ? 'Sign in to continue' : 'Access denied'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {status === 401
                ? 'You need an active session to open this page. Sign in to continue where you left off.'
                : 'Your account does not have permission to open this page. Contact an administrator if you need access.'}
            </p>
            {status === 401 && error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {status === 401 && !user && (
              <Button asChild>
                <Link to="/login" state={{ returnTo }}>
                  Sign in
                </Link>
              </Button>
            )}
            <Button asChild variant={status === 403 ? 'default' : 'outline'}>
              <Link to={user ? '/dashboard' : '/'}>
                {user ? 'Go to dashboard' : 'Go to home'}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </IdentityShell>
  );
}
