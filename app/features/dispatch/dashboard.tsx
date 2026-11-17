import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  ArrowRight,
  ClipboardList,
  MapPin,
  RefreshCw,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { createAdminDeliveryApi } from '~/features/admin-delivery/api';
import { useCustomerParcels } from '~/features/customer-tracking/hooks';
import { formatDateTime } from '~/features/customer-tracking/components';
import { Protected } from '~/features/identity/components';
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Skeleton } from '~/shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import { useCourierDirectory, useCourierWorkload } from './workload-hooks';
import { dispatchSnapshot } from './dashboard-analytics';
import {
  DispatchWorkloadChart,
  DispatchWorkloadModePicker,
  defaultWorkloadMode,
  type ZoneWorkloadMode,
} from './dashboard-chart';

type ReadState = {
  data?: unknown;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
};

function DashboardRead({
  query,
  label,
  children,
}: {
  query: ReadState;
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      {query.isError && (
        <WorkspaceNotice
          destructive
          title={`Unable to ${query.data ? 'refresh' : 'load'} ${label}`}
          description={
            query.data
              ? 'Showing previously loaded results. Try again to get current information.'
              : 'Check your connection and try again.'
          }
          retry={() => {
            void query.refetch();
          }}
          pending={query.isFetching}
        />
      )}
      {query.isPending ? (
        <WorkspaceLoading label={`Loading ${label}…`} />
      ) : query.data ? (
        children
      ) : null}
      {query.isFetching && Boolean(query.data) && (
        <p role="status" className="text-sm text-muted-foreground">
          Refreshing {label}…
        </p>
      )}
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  query,
}: {
  label: string;
  value: number | undefined;
  hint: string;
  icon: LucideIcon;
  query: ReadState;
}) {
  return (
    <Card className="min-w-0" role="group" aria-label={label}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-3 sm:p-6 sm:pb-3">
        <CardDescription>{label}</CardDescription>
        <Icon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </CardHeader>
      <CardContent className="px-4 pb-3 sm:px-6">
        {query.isPending ? (
          <div role="status">
            <span className="sr-only">Loading {label}…</span>
            <Skeleton className="h-9 w-20" />
          </div>
        ) : (
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {value === undefined ? '—' : value.toLocaleString()}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 px-4 pb-4 text-xs text-muted-foreground sm:px-6 sm:pb-6">
        <p>{hint}</p>
        {query.isError && (
          <p className="font-medium text-destructive">
            {query.data
              ? 'Previously loaded · Refresh failed'
              : 'Unavailable · Try again below'}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}

export default function DispatcherDashboard() {
  return (
    <Protected roles={['Dispatcher']}>
      <DispatcherDashboardContent />
    </Protected>
  );
}

function DispatcherDashboardContent() {
  const [zoneMode, setZoneMode] = useState<ZoneWorkloadMode | null>(null);
  const { user, session } = useIdentity();
  const zones = useQuery({
    queryKey: ['delivery-zone-summary', user!.id],
    queryFn: ({ signal }) =>
      createAdminDeliveryApi(session).getZoneSummary(
        undefined,
        undefined,
        signal,
      ),
  });
  const queue = useCustomerParcels(
    { status: 'Created', page: 1, pageSize: 5 },
    true,
  );
  const workload = useCourierWorkload(1);
  const couriers = workload.data?.items.slice(0, 5) ?? [];
  const directory = useCourierDirectory(
    couriers.map((courier) => courier.courierId),
  );
  const snapshot = zones.data ? dispatchSnapshot(zones.data.zones) : undefined;
  const selectedZoneMode =
    zoneMode ?? defaultWorkloadMode(snapshot?.workloads ?? []);
  const refreshing =
    zones.isFetching ||
    queue.isFetching ||
    workload.isFetching ||
    directory.isFetching;
  function refresh() {
    void zones.refetch();
    void queue.refetch();
    void workload.refetch();
    if (couriers.length) void directory.refetch();
  }
  return (
    <WorkspacePage
      title="Dashboard"
      actions={
        <>
          <Button variant="outline" disabled={refreshing} onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
          <Button asChild>
            <Link to="/dispatch/unassigned">
              Open unassigned queue
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </>
      }
    >
      <section
        aria-labelledby="dispatch-overview-heading"
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="dispatch-overview-heading"
            className="text-base font-semibold"
          >
            Current operations
          </h2>
          <Badge variant="outline">All booking dates</Badge>
        </div>
        <div
          className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Dispatch KPIs"
        >
          <Kpi
            label="Awaiting assignment"
            value={queue.data?.totalCount}
            hint="Created parcels in the unassigned queue"
            icon={ClipboardList}
            query={queue}
          />
          <Kpi
            label="In progress"
            value={snapshot?.inProgress}
            hint="Assigned through out for delivery"
            icon={Truck}
            query={zones}
          />
          <Kpi
            label="Out for delivery"
            value={snapshot?.outForDelivery}
            hint="Included in the in-progress total"
            icon={ArrowRight}
            query={zones}
          />
          <Kpi
            label="Zones with backlog"
            value={snapshot?.zonesWithBacklog}
            hint="Zones with parcels awaiting assignment"
            icon={MapPin}
            query={zones}
          />
        </div>
      </section>
      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader className="gap-3 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                <h2 className="text-base">Current zone workload</h2>
              </CardTitle>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <DispatchWorkloadModePicker
                  mode={selectedZoneMode}
                  onModeChange={setZoneMode}
                />
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/dispatch/zones">
                    View zones
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
            <CardDescription>
              Current statuses across all booking dates, grouped as in Zone
              summary. Includes delivered and problem parcels.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            <DashboardRead query={zones} label="zone workload">
              {snapshot && (
                <DispatchWorkloadChart
                  key={selectedZoneMode}
                  zones={snapshot.workloads}
                  mode={selectedZoneMode}
                />
              )}
            </DashboardRead>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="gap-3 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                <h2 className="flex items-center gap-2 text-base">
                  <Users
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Courier workload preview
                </h2>
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dispatch/workload">
                  View workload
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <CardDescription>
              Outstanding assignments across all service dates. Capacity alone
              does not indicate assignment eligibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            <DashboardRead query={workload} label="courier workload">
              {workload.data &&
                (couriers.length ? (
                  <>
                    {directory.isError && (
                      <WorkspaceNotice
                        title="Courier names unavailable"
                        description="Stable courier codes remain visible. Try again to refresh names."
                        retry={() => {
                          void directory.refetch();
                        }}
                        pending={directory.isFetching}
                      />
                    )}
                    {directory.isSuccess &&
                      couriers.some(
                        (courier) => !directory.data[courier.courierId],
                      ) && (
                        <p className="text-xs text-muted-foreground">
                          Some courier names are unavailable. Their stable codes
                          are shown instead.
                        </p>
                      )}
                    <ul
                      aria-label="Courier workload preview"
                      className="divide-y"
                    >
                      {couriers.map((courier) => (
                        <li
                          key={courier.courierId}
                          className="space-y-2 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-medium">
                                {directory.data?.[courier.courierId] ??
                                  courier.courierCode}
                              </p>
                              {directory.data?.[courier.courierId] && (
                                <p className="text-xs text-muted-foreground">
                                  {courier.courierCode}
                                </p>
                              )}
                            </div>
                            <p className="text-sm font-medium tabular-nums">
                              {courier.activeCount} / {courier.capacity}
                              <span className="sr-only">
                                {' '}
                                outstanding assignments / capacity
                              </span>
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              {courier.active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="secondary">
                              {courier.onDuty ? 'On duty' : 'Off duty'}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {couriers.length} of {workload.data.totalCount} courier
                      profiles shown · Preview of the first workload page.
                    </p>
                  </>
                ) : (
                  <WorkspaceNotice
                    title="No courier profiles"
                    description="Courier workload will appear when operational profiles are available."
                  />
                ))}
            </DashboardRead>
          </CardContent>
        </Card>
      </div>
      <Card className="min-w-0">
        <CardHeader className="gap-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <h2 className="text-base">Recent unassigned parcels</h2>
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dispatch/unassigned">
                Open queue
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <CardDescription>
            Newest bookings awaiting assignment. Open the queue to choose a
            courier.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          <DashboardRead query={queue} label="unassigned parcels">
            {queue.data &&
              (queue.data.items.length ? (
                <>
                  <Table className="min-w-[38rem]">
                    <TableCaption className="sr-only">
                      Recent unassigned parcels, newest first
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tracking number</TableHead>
                        <TableHead>Pickup → delivery</TableHead>
                        <TableHead>Booked</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queue.data.items.map((parcel) => (
                        <TableRow key={parcel.id}>
                          <TableCell>
                            <Link
                              className="font-mono text-xs underline-offset-4 hover:underline"
                              to={`/dispatch/parcels/${parcel.id}`}
                            >
                              {parcel.trackingNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {parcel.pickupCity} → {parcel.deliveryCity}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDateTime(parcel.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                to={`/dispatch/parcels/${parcel.id}`}
                                aria-label={`View details for ${parcel.trackingNumber}`}
                              >
                                View details
                                <ArrowRight aria-hidden="true" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground">
                    {queue.data.items.length} of {queue.data.totalCount}{' '}
                    unassigned parcels shown · All booking dates.
                  </p>
                </>
              ) : (
                <WorkspaceNotice
                  title="No parcels awaiting assignment"
                  description="New bookings will appear here when they are ready for courier assignment."
                />
              ))}
          </DashboardRead>
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}
