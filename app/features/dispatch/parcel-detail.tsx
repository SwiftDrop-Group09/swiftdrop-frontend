import { useRef, useState } from 'react';
import { ParcelLiveDetail } from '~/features/customer-tracking/tracking-page';
import { useIdentity } from '~/features/identity/session';
import { Button } from '~/shared/components/ui/button';
import { AssignmentDialog } from './assignment-dialog';
import { UnassignDialog } from './unassign-dialog';

export function DispatcherParcelDetail({ parcelId }: { parcelId: string }) {
  const { user } = useIdentity();
  const [assignment, setAssignment] = useState<{ trackingNumber: string }>();
  const [unassignment, setUnassignment] = useState<{
    trackingNumber: string;
    parcelVersion: string;
  }>();
  const trigger = useRef<HTMLButtonElement>(null);
  const unassignTrigger = useRef<HTMLButtonElement>(null);
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
            <div className="flex flex-wrap gap-2">
              <Button
                ref={trigger}
                disabled={Boolean(assignment) || Boolean(unassignment)}
                onClick={() =>
                  setAssignment({ trackingNumber: parcel.trackingNumber })
                }
              >
                Reassign courier
              </Button>
              <Button
                ref={unassignTrigger}
                variant="outline"
                disabled={Boolean(assignment) || Boolean(unassignment)}
                onClick={() =>
                  setUnassignment({
                    trackingNumber: parcel.trackingNumber,
                    parcelVersion: String(parcel.version),
                  })
                }
              >
                Unassign courier
              </Button>
            </div>
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
      {unassignment && (
        <UnassignDialog
          key={`${user!.id}:${parcelId}:unassign`}
          parcelId={parcelId}
          trackingNumber={unassignment.trackingNumber}
          parcelVersion={unassignment.parcelVersion}
          close={() => setUnassignment(undefined)}
          restoreFocus={() => {
            if (
              unassignTrigger.current?.isConnected &&
              !unassignTrigger.current.disabled
            )
              unassignTrigger.current.focus();
            else container.current?.focus();
          }}
        />
      )}
    </div>
  );
}
