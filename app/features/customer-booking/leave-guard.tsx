import { useBlocker } from 'react-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/shared/components/ui/alert-dialog';
import { useIdentity } from '~/features/identity/session';
import { Button } from '~/shared/components/ui/button';

export function BookingLeaveGuard({
  active,
  discard,
}: {
  active: boolean;
  discard: () => void;
}) {
  const { user, logoutRequested } = useIdentity();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active &&
      !logoutRequested &&
      !!user?.roles.includes('Customer') &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  return (
    <AlertDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Keep a draft for this browser session, or discard your unfinished
            details. Drafts are cleared on reload or sign-out. Any unverified
            confirmation is retained so you can safely recover its outcome when
            you return.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              if (blocker.state === 'blocked') blocker.reset();
            }}
          >
            Keep editing
          </AlertDialogCancel>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (blocker.state === 'blocked') blocker.proceed();
            }}
          >
            Keep draft & leave
          </Button>
          <AlertDialogAction
            onClick={() => {
              discard();
              if (blocker.state === 'blocked') blocker.proceed();
            }}
          >
            Discard details & leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
