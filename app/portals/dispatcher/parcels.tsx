import { IdentityShell, Protected } from '~/features/identity/components';
import { OrderHistoryContent } from '~/features/customer-tracking/history-page';
export default function Parcels() {
  return (
    <IdentityShell>
      <Protected roles={['Admin', 'Dispatcher']}>
        <OrderHistoryContent operational />
      </Protected>
    </IdentityShell>
  );
}
