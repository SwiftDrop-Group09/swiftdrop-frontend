import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '~/features/identity/session';
import { Button } from '~/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/shared/components/ui/dialog';
import { Textarea } from '~/shared/components/ui/textarea';
import { Label } from '~/shared/components/ui/label';
import {
  AssignmentError,
  submitUnassign,
  unassignAttempt,
  type AssignmentAttempt,
} from './assignment-api';

export function UnassignDialog({
  parcelId,
  trackingNumber,
  parcelVersion,
  close,
  restoreFocus,
}: {
  parcelId: string;
  trackingNumber: string;
  parcelVersion: string;
  close: () => void;
  restoreFocus: () => void;
}) {
  const { session, user } = useIdentity();
  const queries = useQueryClient();
  const [reason, setReason] = useState('');
  const [attempt, setAttempt] = useState<AssignmentAttempt>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AssignmentError>();
  const [confirmed, setConfirmed] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);

  const lifecycle = useRef({
    generation: 0,
    controller: undefined as AbortController | undefined,
  });
  const inFlight = useRef(false);

  useEffect(() => {
    const lifetime = lifecycle.current;
    lifetime.generation++;
    return () => {
      lifetime.generation++;
      lifetime.controller?.abort();
    };
  }, []);

  useEffect(() => {
    if (!attempt) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [attempt]);

  const validReason = reason.trim().length <= 500;
  const locked = busy || Boolean(attempt);
  const denied = error && [401, 403, 404].includes(error.status);

  async function invalidate() {
    await Promise.all([
      queries.invalidateQueries({
        queryKey: ['customer-parcels', user!.id, true],
      }),
      queries.invalidateQueries({
        queryKey: ['customer-parcel', parcelId, user!.id, true],
      }),
      ...[
        'dispatch-workload',
        'dispatch-assignments',
        'dispatch-assignment-options',
        'delivery-zone-summary',
      ].map((key) => queries.invalidateQueries({ queryKey: [key, user!.id] })),
    ]);
  }

  async function submit() {
    if (inFlight.current || now < retryAt || denied || !validReason) return;
    let nextAttempt: AssignmentAttempt;
    try {
      nextAttempt = attempt ?? unassignAttempt(parcelId, parcelVersion, reason);
    } catch (err) {
      setError(
        new AssignmentError(
          err instanceof Error ? err.message : 'validation',
          400,
        ),
      );
      return;
    }

    const generation = lifecycle.current.generation;
    inFlight.current = true;
    setAttempt(nextAttempt);
    setBusy(true);
    setError(undefined);
    lifecycle.current.controller = new AbortController();

    try {
      await submitUnassign(
        session.authenticatedRequest,
        session.api.base,
        nextAttempt,
        lifecycle.current.controller.signal,
      );
      if (generation !== lifecycle.current.generation) return;
      setConfirmed(true);
      setAttempt(undefined);
      await invalidate();
    } catch (e) {
      if (generation !== lifecycle.current.generation) return;
      const problem =
        e instanceof AssignmentError ? e : new AssignmentError('network');
      setError(problem);
      if (problem.uncertain) {
        setRetryAt(Date.now() + problem.retryAfter * 1000);
        setNow(Date.now());
      } else {
        setAttempt(undefined);
        await invalidate();
      }
    } finally {
      if (generation === lifecycle.current.generation) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !locked) close();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
        onEscapeKeyDown={(event) => {
          if (locked) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (locked) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Unassign courier</DialogTitle>
          <DialogDescription>Parcel {trackingNumber}</DialogDescription>
        </DialogHeader>

        {confirmed ? (
          <div className="space-y-4 py-2">
            <p role="status" className="text-sm text-foreground">
              Courier unassigned successfully. The parcel has been returned to
              Created status.
            </p>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to unassign the courier? The parcel will be
              returned to Created status and removed from the courier's active
              workload.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="unassign-reason">Reason (optional)</Label>
                <span className="text-xs text-muted-foreground">
                  {reason.trim().length}/500
                </span>
              </div>
              <Textarea
                id="unassign-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for unassigning..."
                disabled={locked}
                maxLength={500}
                rows={3}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error.message}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                disabled={locked}
                onClick={close}
                type="button"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={locked || !validReason || now < retryAt}
                onClick={() => {
                  void submit();
                }}
                type="button"
              >
                {busy
                  ? 'Unassigning...'
                  : now < retryAt
                    ? `Retry in ${Math.ceil((retryAt - now) / 1000)}s`
                    : 'Confirm unassign'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
