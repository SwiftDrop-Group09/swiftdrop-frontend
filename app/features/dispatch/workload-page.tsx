import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { createAdminDeliveryApi } from '~/features/admin-delivery/api';
import { IdentityShell, Protected } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
import { WorkspacePage } from '~/shared/components/workspace-page';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/shared/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import { DispatchReadError, type CourierWorkload } from './workload-api';
import { useCourierWorkload, useDispatchAssignments } from './workload-hooks';

const PAGE_SIZE = 20;

// Feature pagination composes the shared controls; each read owns its page state.
function WorkloadPagination({
  page,
  total,
  pending,
  onPage,
  label,
}: {
  page: number;
  total: number;
  pending: boolean;
  onPage: (page: number) => void;
  label: string;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-2 pt-4"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Page {page} of {pages} · {total}{' '}
        {label === 'Courier pages' ? 'couriers' : 'assignments'}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

function AssignmentContent({
  courierId,
  refreshWorkload,
}: {
  courierId: string;
  refreshWorkload: () => void;
}) {
  const [page, setPage] = useState(1);
  const query = useDispatchAssignments(courierId, page);
  const { data } = query;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;
  const correcting = query.isSuccess && page > pages;
  if (correcting) setPage(pages);
  const missing =
    query.error instanceof DispatchReadError && query.error.status === 404;

  function refresh() {
    void query.refetch();
    refreshWorkload();
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={refresh}
        >
          <RefreshCw aria-hidden="true" />
          Refresh assignments
        </Button>
      </div>
      {query.isFetching && data && (
        <p role="status" className="text-sm text-muted-foreground">
          Refreshing assignments…
        </p>
      )}
      {query.isError && (
        <WorkspaceNotice
          destructive
          title={missing ? 'Courier not found' : 'Unable to load assignments'}
          description={
            data
              ? 'Showing previously loaded assignments. Refresh to get current information.'
              : missing
                ? 'This courier profile is no longer available.'
                : 'Check your connection and try again.'
          }
          retry={missing ? undefined : refresh}
          pending={query.isFetching}
        />
      )}
      {query.isPending || correcting ? (
        <WorkspaceLoading label="Loading active assignments…" />
      ) : (
        data && (
          <>
            {data.items.length === 0 ? (
              <WorkspaceNotice
                title="No active assignments"
                description="This courier has no outstanding assignments across any service date."
              />
            ) : (
              <Table>
                <TableCaption>
                  Outstanding assignments across all service dates.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Service date</TableHead>
                    <TableHead>Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.parcelId}>
                      <TableCell>
                        <Button asChild variant="link" className="h-auto p-0">
                          <Link
                            to={`/dispatch/parcels/${encodeURIComponent(item.parcelId)}`}
                            aria-label={`View details for ${item.trackingNumber}`}
                          >
                            {item.trackingNumber}
                          </Link>
                        </Button>
                      </TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.serviceDate}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(item.assignedAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <WorkloadPagination
              page={page}
              total={data.totalCount}
              pending={query.isFetching}
              onPage={setPage}
              label="Assignment pages"
            />
          </>
        )
      )}
    </div>
  );
}

function WorkloadContent() {
  const { session, user } = useIdentity();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CourierWorkload | null>(null);
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);
  const query = useCourierWorkload(page);
  const zones = useQuery({
    queryKey: ['dispatch-zone-summary', user!.id],
    queryFn: () => createAdminDeliveryApi(session).getZoneSummary(),
  });
  const { data } = query;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;
  const correcting = query.isSuccess && page > pages;
  if (correcting) setPage(pages);

  function refresh() {
    void query.refetch();
    void zones.refetch();
  }

  return (
    <WorkspacePage
      title="Courier workload"
      actions={
        <Button
          variant="outline"
          disabled={query.isFetching || zones.isFetching}
          onClick={refresh}
        >
          <RefreshCw aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Outstanding work by courier</CardTitle>
          <CardDescription>
            Counts include all active assignments, including overdue and future
            service dates. Daily capacity is informational here; assignment
            eligibility is checked when assigning a parcel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {zones.isError && (
            <WorkspaceNotice
              title="Zone names unavailable"
              description="Zone IDs remain visible. Refresh to try loading the names again."
              retry={() => {
                void zones.refetch();
              }}
              pending={zones.isFetching}
            />
          )}
          {query.isFetching && data && (
            <p role="status" className="py-4 text-sm text-muted-foreground">
              Refreshing workload…
            </p>
          )}
          {query.isError && (
            <WorkspaceNotice
              destructive
              title="Unable to load courier workload"
              description={
                data
                  ? 'Showing previously loaded workload. Refresh to get current information.'
                  : 'Check your connection and try again.'
              }
              retry={() => {
                void query.refetch();
              }}
              pending={query.isFetching}
            />
          )}
          {query.isPending || correcting ? (
            <WorkspaceLoading label="Loading courier workload…" />
          ) : (
            data && (
              <>
                {data.items.length === 0 ? (
                  <WorkspaceNotice
                    title="No courier profiles"
                    description="Workload will appear when operational courier profiles are available."
                  />
                ) : (
                  <Table>
                    <TableCaption>
                      All operational profiles, including inactive and off-duty
                      couriers.
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Courier ID</TableHead>
                        <TableHead>Profile</TableHead>
                        <TableHead>Duty</TableHead>
                        <TableHead>Zones</TableHead>
                        <TableHead className="text-right">
                          Outstanding
                        </TableHead>
                        <TableHead className="text-right">
                          Daily capacity
                        </TableHead>
                        <TableHead>Assignments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((courier) => (
                        <TableRow key={courier.courierId}>
                          <TableCell className="max-w-52 break-all font-mono text-xs">
                            {courier.courierId}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {courier.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {courier.onDuty ? 'On duty' : 'Off duty'}
                          </TableCell>
                          <TableCell className="max-w-64 break-words">
                            {courier.zoneIds.length
                              ? courier.zoneIds
                                  .map(
                                    (id) =>
                                      zones.data?.zones.find(
                                        (zone) => zone.zoneId === id,
                                      )?.name ?? id,
                                  )
                                  .join(', ')
                              : 'No zones'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {courier.activeCount}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {courier.capacity}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`View active parcels for ${courier.courierId}`}
                              onClick={(event) => {
                                selectedTrigger.current = event.currentTarget;
                                setSelected(courier);
                              }}
                            >
                              View active parcels
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <WorkloadPagination
                  page={page}
                  total={data.totalCount}
                  pending={query.isFetching}
                  onPage={setPage}
                  label="Courier pages"
                />
              </>
            )
          )}
        </CardContent>
      </Card>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto sm:max-w-4xl"
          onCloseAutoFocus={(event) => {
            if (selectedTrigger.current?.isConnected) {
              event.preventDefault();
              selectedTrigger.current.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Active parcels</DialogTitle>
            <DialogDescription className="break-all">
              Courier {selected?.courierId}. Includes overdue and future service
              dates.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <AssignmentContent
              key={selected.courierId}
              courierId={selected.courierId}
              refreshWorkload={refresh}
            />
          )}
        </DialogContent>
      </Dialog>
    </WorkspacePage>
  );
}

export function CourierWorkloadPage() {
  const { user } = useIdentity();
  return (
    <IdentityShell>
      <Protected roles={['Dispatcher', 'Admin']}>
        <WorkloadContent key={user?.id} />
      </Protected>
    </IdentityShell>
  );
}
