import { useParams } from 'react-router';
import { IdentityShell, Protected } from '~/features/identity/components';
import { ParcelLiveDetail } from '~/features/customer-tracking/tracking-page';
export default function Parcel() {
  const { id } = useParams();
  return (
    <IdentityShell>
      <Protected roles={['Admin', 'Dispatcher']}>
        <ParcelLiveDetail parcelId={id!} operational />
      </Protected>
    </IdentityShell>
  );
}
