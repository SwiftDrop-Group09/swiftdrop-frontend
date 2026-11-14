import { IdentityShell, Protected } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
import { CustomerBookingPage } from './booking-page';
import { bookingEnvironmentFor } from './session-environment';

function SignedInBooking() {
  const { session } = useIdentity();
  const environment = bookingEnvironmentFor(session);
  return <CustomerBookingPage environment={environment} />;
}

export function CustomerBookingWorkspace() {
  return (
    <IdentityShell>
      <Protected roles={['Customer']}>
        <SignedInBooking />
      </Protected>
    </IdentityShell>
  );
}
