import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useIdentity } from '~/features/identity/session';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Button } from '~/shared/components/ui/button';
import { Calendar } from '~/shared/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/shared/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/shared/components/ui/popover';
import { Textarea } from '~/shared/components/ui/textarea';
import { Label } from '~/shared/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import {
  AssignmentError,
  assignmentAttempt,
  getAssignmentOptions,
  submitAssignment,
  type AssignmentAttempt,
  type AssignmentCandidate,
  type AssignmentOptions,
} from './assignment-api';

export function AssignmentDialog({
  parcelId,
  trackingNumber,
  close,
  restoreFocus,
  reassign = false,
}: {
  parcelId: string;
  trackingNumber: string;
  close: () => void;
  restoreFocus: () => void;
  reassign?: boolean;
}) {
  const { session, user } = useIdentity();
  const queries = useQueryClient();
  const [date, setDate] = useState<string>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<{
    courier: AssignmentCandidate;
    preview: AssignmentOptions;
  }>();
  const [reason, setReason] = useState('');
  const [attempt, setAttempt] = useState<AssignmentAttempt>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AssignmentError>();
  const [confirmed, setConfirmed] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
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
  const optionsKey = [
    'dispatch-assignment-options',
    user!.id,
    parcelId,
    reassign,
    date,
    page,
  ];
  const options = useQuery({
    queryKey: optionsKey,
    queryFn: ({ signal }) =>
      getAssignmentOptions(
        session.authenticatedRequest,
        session.api.base,
        parcelId,
        date,
        page,
        signal,
        reassign,
      ),
    structuralSharing: false,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !attempt && !confirmed,
  });
  const data = options.data;
  // A selection belongs to one response, never a newer version returned by refresh.
  const selected =
    selection &&
    !options.isFetching &&
    !options.isError &&
    selection.preview === data
      ? selection.courier
      : undefined;
  if (selection && !selected) setSelection(undefined);
  const validReason =
    !reassign || (reason.trim().length >= 1 && reason.trim().length <= 500);
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / 20)) : 1;
  if (options.isSuccess && page > totalPages) setPage(totalPages);
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
        'dispatch-zone-summary',
      ].map((key) => queries.invalidateQueries({ queryKey: [key, user!.id] })),
    ]);
  }
  async function submit() {
    if (inFlight.current || now < retryAt || denied || needsReload) return;
    if (
      !attempt &&
      (!data ||
        !selected ||
        options.isFetching ||
        options.isError ||
        !validReason ||
        selection?.preview !== queries.getQueryData(optionsKey) ||
        queries.getQueryState(optionsKey)?.fetchStatus !== 'idle')
    )
      return;
    const original =
      attempt ??
      assignmentAttempt(
        parcelId,
        selected!.courierId,
        data!.parcelVersion,
        data!.serviceDate,
        reassign ? { reason } : undefined,
      );
    const generation = lifecycle.current.generation;
    inFlight.current = true;
    setAttempt(original);
    setBusy(true);
    setError(undefined);
    lifecycle.current.controller = new AbortController();
    try {
      await submitAssignment(
        session.authenticatedRequest,
        session.api.base,
        original,
        lifecycle.current.controller.signal,
      );
      if (generation !== lifecycle.current.generation) return;
      setConfirmed(true);
      setAttempt(undefined);
      setSelection(undefined);
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
        setNeedsReload(true);
        setSelection(undefined);
        await invalidate();
      }
    } finally {
      if (generation === lifecycle.current.generation) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  function reload() {
    setSelection(undefined);
    setNeedsReload(false);
    setError(undefined);
    void options.refetch();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !locked) close();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
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
          <DialogTitle>
            {reassign ? 'Reassign courier' : 'Assign courier'}
          </DialogTitle>
          <DialogDescription>Parcel {trackingNumber}</DialogDescription>
        </DialogHeader>
        {confirmed ? (
          <>
            <p role="status">
              {reassign
                ? 'Reassignment confirmed. Review the updated parcel and courier workload.'
                : 'Assignment confirmed. Return to the queue to review remaining parcels.'}
            </p>
            <Button disabled={busy} onClick={close}>
              Done
            </Button>
          </>
        ) : (
          <>
            {data && (
              <div className="space-y-2">
                {reassign && data.currentAssignment && (
                  <p className="text-sm break-all">
                    Current courier {data.currentAssignment.courierId} ·
                    scheduled{' '}
                    <span className="whitespace-nowrap">
                      {data.currentAssignment.serviceDate}
                    </span>
                  </p>
                )}
                <Label htmlFor="assignment-service-date">Service date</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="assignment-service-date"
                      variant="outline"
                      className="w-full justify-start"
                      disabled={locked}
                    >
                      {data.serviceDate}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="start"
                    aria-label="Service date"
                  >
                    <Calendar
                      mode="single"
                      selected={new Date(`${data.serviceDate}T12:00:00`)}
                      defaultMonth={new Date(`${data.serviceDate}T12:00:00`)}
                      disabled={(day) =>
                        format(day, 'yyyy-MM-dd') < data.businessToday
                      }
                      autoFocus
                      onSelect={(day) => {
                        if (day) {
                          setDate(format(day, 'yyyy-MM-dd'));
                          setPage(1);
                          setSelection(undefined);
                          setError(undefined);
                          setNeedsReload(false);
                          setCalendarOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-sm text-muted-foreground">
                  Dates use {data.operationsTimeZone}. Capacity is reserved per
                  service date. Future scheduling permits off-duty couriers and
                  does not restrict early pickup.
                </p>
              </div>
            )}
            {options.isPending && (
              <WorkspaceLoading label="Loading eligible couriers…" />
            )}
            {options.isError && (
              <WorkspaceNotice
                title="Available couriers could not be loaded"
                description={
                  options.error instanceof AssignmentError
                    ? options.error.message
                    : 'Reload to check availability.'
                }
                retry={reload}
                pending={options.isFetching}
              />
            )}
            {data && !options.isError && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    Eligible couriers for {data.serviceDate}
                  </p>
                  <Button
                    variant="outline"
                    disabled={locked || options.isFetching}
                    onClick={reload}
                  >
                    Refresh couriers
                  </Button>
                </div>
                {data.items.length === 0 ? (
                  <WorkspaceNotice
                    title="No eligible couriers"
                    description="Choose another service date or refresh availability."
                  />
                ) : (
                  <Table className="min-w-[36rem] whitespace-nowrap">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Courier</TableHead>
                        <TableHead>On duty now</TableHead>
                        <TableHead>Daily work / capacity</TableHead>
                        <TableHead>Select</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((courier) => (
                        <TableRow key={courier.courierId}>
                          <TableCell className="font-mono text-xs">
                            {courier.courierId}
                          </TableCell>
                          <TableCell>{courier.onDuty ? 'Yes' : 'No'}</TableCell>
                          <TableCell>
                            {courier.activeCountForServiceDate} /{' '}
                            {courier.capacity}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={
                                selected?.courierId === courier.courierId
                                  ? 'default'
                                  : 'outline'
                              }
                              aria-pressed={
                                selected?.courierId === courier.courierId
                              }
                              aria-label={`Select courier ${courier.courierId}`}
                              disabled={
                                locked || options.isFetching || needsReload
                              }
                              onClick={() =>
                                setSelection({ courier, preview: data })
                              }
                            >
                              {selected?.courierId === courier.courierId
                                ? 'Selected'
                                : 'Select'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={locked || options.isFetching || page <= 1}
                      onClick={() => {
                        setPage(page - 1);
                        setSelection(undefined);
                      }}
                    >
                      Previous couriers
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={
                        locked || options.isFetching || page >= totalPages
                      }
                      onClick={() => {
                        setPage(page + 1);
                        setSelection(undefined);
                      }}
                    >
                      Next couriers
                    </Button>
                  </div>
                )}
              </>
            )}
            {reassign && data && (
              <div className="space-y-2">
                <Label htmlFor="assignment-reason">Reassignment reason</Label>
                <Textarea
                  id="assignment-reason"
                  value={reason}
                  disabled={locked}
                  onChange={(event) => setReason(event.target.value)}
                  aria-describedby="assignment-reason-help"
                />
                <p
                  id="assignment-reason-help"
                  className="text-sm text-muted-foreground"
                >
                  Required: 1–500 characters after trimming. The reason is
                  retained in parcel history.
                </p>
                {!validReason && reason.length > 0 && (
                  <p role="alert" className="text-sm text-destructive">
                    Enter a reason of 1–500 characters.
                  </p>
                )}
              </div>
            )}
            {selected && (
              <p className="text-sm break-all">
                Confirm {trackingNumber} → courier {selected.courierId} on{' '}
                {data?.serviceDate}.{reassign && <> Reason: {reason.trim()}</>}
              </p>
            )}
            {error && (
              <div role="alert" className="space-y-2 text-sm">
                <p>{error.message}</p>
                {attempt && (
                  <p>
                    The outcome is uncertain. Your original request is retained;
                    retry uses the same request and key. Cancelling a request
                    does not guarantee server rollback.
                  </p>
                )}
                {needsReload && !denied && (
                  <Button variant="outline" disabled={busy} onClick={reload}>
                    Reload available couriers
                  </Button>
                )}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={locked} onClick={close}>
                Cancel
              </Button>
              <Button
                disabled={
                  busy ||
                  Boolean(denied) ||
                  needsReload ||
                  now < retryAt ||
                  (!attempt &&
                    (!selected ||
                      !validReason ||
                      options.isFetching ||
                      options.isError))
                }
                onClick={() => void submit()}
              >
                {busy
                  ? reassign
                    ? 'Reassigning…'
                    : 'Assigning…'
                  : attempt
                    ? now < retryAt
                      ? 'Please wait before retrying'
                      : 'Retry same assignment'
                    : reassign
                      ? 'Confirm reassignment'
                      : 'Confirm assignment'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
