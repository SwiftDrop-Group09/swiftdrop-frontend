import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '~/shared/components/ui/card';
import { Link } from 'react-router';
import { IdentityShell } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
export default function Index() {
  const { user } = useIdentity();
  return (
    <IdentityShell>
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Welcome to SwiftDrop
          </p>
          <CardTitle className="text-3xl" role="heading" aria-level={1}>
            Your account, in one place.
          </CardTitle>
          <CardDescription>
            Sign in to manage your profile and account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to={user ? '/dashboard' : '/login'}>
              {user ? 'Open dashboard' : 'Sign in'}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </IdentityShell>
  );
}
