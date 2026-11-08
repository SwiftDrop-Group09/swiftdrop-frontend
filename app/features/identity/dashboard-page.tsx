import { IdentityShell, Protected } from './components';

export function DashboardPage() {
  return (
    <IdentityShell>
      <Protected>
        <div className="min-h-80 flex-1" aria-label="Dashboard workspace" />
      </Protected>
    </IdentityShell>
  );
}
