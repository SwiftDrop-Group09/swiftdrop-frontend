import { RoleHome } from '~/features/identity/role-home';
import { IdentityShell, Protected } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
import { CustomerDashboardContent } from './customer-pages';

export function CustomerDashboardWorkspace() {
  const { user } = useIdentity();
  return (
    <IdentityShell>
      <Protected>
        {user?.roles.includes('Customer') ? (
          <CustomerDashboardContent />
        ) : (
          <RoleHome />
        )}
      </Protected>
    </IdentityShell>
  );
}
