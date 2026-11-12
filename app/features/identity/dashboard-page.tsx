import { IdentityShell, Protected } from './components';
import { RoleHome } from './role-home';

export function DashboardPage() {
  return (
    <IdentityShell>
      <Protected>
        <RoleHome />
      </Protected>
    </IdentityShell>
  );
}
