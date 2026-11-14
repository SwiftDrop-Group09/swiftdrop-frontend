import { useRef, useState } from 'react';
import { ParcelLiveDetail } from '~/features/customer-tracking/tracking-page';
import { useIdentity } from '~/features/identity/session';
import { Button } from '~/shared/components/ui/button';
import { AssignmentDialog } from './assignment-dialog';

export function DispatcherParcelDetail({ parcelId }: { parcelId: string }) {
  const { user } = useIdentity();
  const [assignment, setAssignment] = useState<{ trackingNumber: string }>();
  const trigger = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  return (
    <div ref={container} tabIndex={-1} className="w-full min-w-0">
      <ParcelLiveDetail
        parcelId={parcelId}
        operational
        renderActions={(parcel) =>
          user?.roles.some(
            (role) => role === 'Dispatcher' || role === 'Admin',
          ) &&
          parcel.status === 'Assigned' &&
          parcel.assignment?.status === 'Active' &&
          !parcel.assignment.pickedUpAt ? (
            <Button
              ref={trigger}
              disabled={Boolean(assignment)}
              onClick={() =>
                setAssignment({ trackingNumber: parcel.trackingNumber })
              }
            >
              Reassign courier
            </Button>
          ) : null
        }
      />
      {assignment && (
        <AssignmentDialog
          key={`${user!.id}:${parcelId}`}
          parcelId={parcelId}
          trackingNumber={assignment.trackingNumber}
          reassign
          close={() => setAssignment(undefined)}
          restoreFocus={() => {
            if (trigger.current?.isConnected && !trigger.current.disabled)
              trigger.current.focus();
            else container.current?.focus();
          }}
        />
      )}
    </div>
  );
}
