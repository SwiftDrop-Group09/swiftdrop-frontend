import { Link } from 'react-router';
import { IdentityShell } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
export default function Index() {
  const { user } = useIdentity();
  return (
    <IdentityShell>
      <section className="card">
        <p className="eyebrow">Welcome to SwiftDrop</p>
        <h1>Your account, in one place.</h1>
        <p>Sign in to manage your profile and account.</p>
        <Link className="button-link" to={user ? '/profile' : '/login'}>
          {user ? 'Open my profile' : 'Sign in'}
        </Link>
      </section>
    </IdentityShell>
  );
}
