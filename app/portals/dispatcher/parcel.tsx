import { useParams } from 'react-router';
import { IdentityShell, Protected } from '~/features/identity/components';
import { DispatcherParcelDetail } from '~/features/dispatch/parcel-detail';
import { useIdentity } from '~/features/identity/session';
export default function Parcel() {
  const { id } = useParams();
  const { user } = useIdentity();
  return (
    <IdentityShell>
      <Protected roles={['Admin', 'Dispatcher']}>
        <DispatcherParcelDetail key={`${user?.id}:${id}`} parcelId={id!} />
      </Protected>
    </IdentityShell>
  );
}
