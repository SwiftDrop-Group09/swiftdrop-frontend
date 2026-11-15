import { IdentityShell, Protected } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
import { CustomerBookingPage } from './booking-page';
import { bookingEnvironmentFor } from './session-environment';
import { BookingLeaveGuard } from './leave-guard';
import { useNavigate } from 'react-router';

function SignedInBooking() {
  const { session, user } = useIdentity();
  const navigate = useNavigate();
  const environment = bookingEnvironmentFor(session);
  return (
    <CustomerBookingPage
      environment={environment}
      profile={user ?? undefined}
      navigationGuard={(active, discard) => (
        <BookingLeaveGuard active={active} discard={discard} />
      )}
      viewDelivery={(id) =>
        void navigate(`/customer/parcels/${encodeURIComponent(id)}`, {
          state: { returnTo: '/customer/history' },
        })
      }
    />
  );
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
