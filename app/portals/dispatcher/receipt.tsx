import { useParams } from 'react-router';
import { IdentityShell, Protected } from '~/features/identity/components';
import { ParcelReceiptDetail } from '~/features/customer-tracking/receipt-page';
export default function Receipt() {
  const { id } = useParams();
  return (
    <IdentityShell>
      <Protected roles={['Admin']}>
        <ParcelReceiptDetail parcelId={id!} operational />
      </Protected>
    </IdentityShell>
  );
}
