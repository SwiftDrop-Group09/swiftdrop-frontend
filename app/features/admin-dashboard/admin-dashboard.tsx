import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Minus,
  RefreshCw,
  Store,
} from 'lucide-react';
import { useIdentity } from '~/features/identity/session';
import { Protected } from '~/features/identity/components';
import { AdminWorkspace } from '~/features/identity/admin-workspace';
import { createAdminDeliveryApi } from '~/features/admin-delivery/api';
import {
  getPreviousReportRange,
  getUtcDatePreset,
  getUtcIsoRange,
} from '~/features/admin-delivery/report-date-range';
import {
  ReportPeriod,
  formatReportDate,
} from '~/features/admin-delivery/report-period';
import { MerchantApi } from '~/features/merchant/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Skeleton } from '~/shared/components/ui/skeleton';
import { metricComparison, zoneWorkloads } from './analytics';
import { DeliveryCharts, WorkloadChart } from './delivery-charts';
import { DashboardInfo } from './dashboard-info';

function Kpi({
  label,
  value,
  previous,
  rate = false,
  lowerIsBetter = false,
  unavailable,
}: {
  label: string;
  value: number;
  previous?: number;
  rate?: boolean;
  lowerIsBetter?: boolean;
  unavailable: boolean;
}) {
  const comparison =
    previous === undefined ? null : metricComparison(value, previous, rate);
  const worse =
    comparison &&
    (lowerIsBetter ? comparison.direction > 0 : comparison.direction < 0);
  const Trend = !comparison?.direction
    ? Minus
    : comparison.direction > 0
      ? ArrowUpRight
      : ArrowDownRight;
  return (
    <Card className="min-w-0">
      <CardHeader className="flex min-h-16 flex-row items-center justify-between gap-2 p-4 pb-2">
        <CardDescription>{label}</CardDescription>
        <div className="flex items-center gap-1">
          <DashboardInfo label={label}>
            {label === 'Terminal outcomes'
              ? 'Delivered plus failed transitions in the selected UTC period.'
              : label === 'Success rate'
                ? 'Delivered divided by delivered plus failed. Cancellations are excluded; no terminal outcomes gives 0%.'
                : label === 'Failure rate'
                  ? 'Failed divided by delivered plus failed. Cancellations are excluded; no terminal outcomes gives 0%.'
                  : label === 'Cancelled'
                    ? 'Cancelled transitions in the selected period, excluded from success and failure rates.'
                    : `${label} transitions in the selected UTC period.`}{' '}
            {rate
              ? 'Comparison shows percentage-point change.'
              : 'Comparison shows percentage change; a zero baseline with new outcomes is labelled New activity.'}
          </DashboardInfo>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <p className="text-2xl font-semibold tabular-nums">
          {rate ? `${(value * 100).toFixed(1)}%` : value.toLocaleString()}
        </p>
        {comparison ? (
          <div className="space-y-1">
            <Badge
              variant="outline"
              className={worse ? 'text-destructive' : 'text-foreground'}
            >
              <Trend className="mr-1 size-3" aria-hidden="true" />
              {comparison.label}
            </Badge>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {unavailable ? 'Comparison unavailable' : 'Loading comparison...'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  return (
    <Protected admin>
      <AdminDashboardContent />
    </Protected>
  );
}
function AdminDashboardContent() {
  const { session, user } = useIdentity();
  const api = useMemo(() => createAdminDeliveryApi(session), [session]);
  const merchantsApi = useMemo(
    () => new MerchantApi(session.authenticatedRequest, session.api.base),
    [session],
  );
  const queries = useQueryClient();
  const [period, setPeriod] = useState(() => getUtcDatePreset(30));
  const range = getUtcIsoRange(period.startDate, period.endDate);
  const preceding = getPreviousReportRange(period.startDate, period.endDate)!;
  const report = useQuery({
    queryKey: ['admin-delivery-report', user!.id, range.fromUtc, range.toUtc],
    queryFn: ({ signal }) =>
      api.getDeliveryReport(range.fromUtc, range.toUtc, signal),
    retry: false,
  });
  const previous = useQuery({
    queryKey: [
      'admin-delivery-report',
      user!.id,
      preceding.fromUtc,
      preceding.toUtc,
    ],
    queryFn: ({ signal }) =>
      api.getDeliveryReport(preceding.fromUtc, preceding.toUtc, signal),
    retry: false,
  });
  const workload = useQuery({
    queryKey: ['admin-zone-summary', user!.id],
    queryFn: ({ signal }) => api.getZoneSummary(undefined, undefined, signal),
    retry: false,
  });
  const merchants = useQuery({
    queryKey: ['admin-merchants', user!.id],
    queryFn: () => merchantsApi.listMerchants(),
    retry: false,
  });
  const current = !report.isError ? report.data : undefined;
  const baseline = !previous.isError ? previous.data : undefined;
  const zones =
    workload.data && !workload.isError
      ? zoneWorkloads(workload.data.zones)
      : undefined;
  const pending =
    merchants.data && !merchants.isError
      ? merchants.data
          .filter((business) => business.status === 'Pending')
          .sort(
            (a, b) =>
              a.registeredAt.localeCompare(b.registeredAt) ||
              a.id.localeCompare(b.id),
          )
      : undefined;
  const refreshing =
    report.isFetching ||
    previous.isFetching ||
    workload.isFetching ||
    merchants.isFetching;
  const reportUrl = `/admin/reports?from=${period.startDate}&through=${period.endDate}`;
  function refresh() {
    for (const key of [
      'admin-delivery-report',
      'admin-zone-summary',
      'admin-merchants',
    ])
      void queries.invalidateQueries({ queryKey: [key, user!.id] });
  }
  const kpis = current
    ? [
        {
          label: 'Terminal outcomes',
          value: current.terminalCount,
          previous: baseline?.terminalCount,
        },
        {
          label: 'Delivered',
          value: current.delivered,
          previous: baseline?.delivered,
        },
        {
          label: 'Success rate',
          value: current.successRate,
          previous: baseline?.successRate,
          rate: true,
        },
        {
          label: 'Failed',
          value: current.failed,
          previous: baseline?.failed,
          lowerIsBetter: true,
        },
        {
          label: 'Failure rate',
          value: current.failureRate,
          previous: baseline?.failureRate,
          rate: true,
          lowerIsBetter: true,
        },
        {
          label: 'Cancelled',
          value: current.cancelled,
          previous: baseline?.cancelled,
          lowerIsBetter: true,
        },
      ]
    : [];
  return (
    <AdminWorkspace
      title="Dashboard"
      actions={
        <>
          <ReportPeriod value={period} onChange={setPeriod} />
          <Button variant="outline" disabled={refreshing} onClick={refresh}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Delivery performance</h2>
          <DashboardInfo label="delivery performance">
            Selected period: {formatReportDate(period.startDate)} -{' '}
            {formatReportDate(period.endDate)} (UTC). Compared with{' '}
            {formatReportDate(preceding.fromUtc.slice(0, 10))} -{' '}
            {formatReportDate(
              new Date(Date.parse(preceding.toUtc) - 86400000)
                .toISOString()
                .slice(0, 10),
            )}
            . The current UTC day may be incomplete.
          </DashboardInfo>
        </div>
        <Button variant="ghost" asChild>
          <Link to={reportUrl}>
            View delivery report
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      {report.isPending ? (
        <div
          aria-label="Loading performance overview"
          className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : report.isError ? (
        <WorkspaceNotice
          destructive
          title="Delivery performance unavailable"
          description="The selected period could not be loaded. Operations snapshots remain independent."
          retry={() => void report.refetch()}
          pending={report.isFetching}
        />
      ) : (
        current && (
          <>
            <div
              className="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6"
              aria-label="Delivery performance KPIs"
            >
              {kpis.map((kpi) => (
                <Kpi key={kpi.label} {...kpi} unavailable={previous.isError} />
              ))}
            </div>
            {previous.isError && (
              <WorkspaceNotice
                title="Previous-period comparison unavailable"
                description="Current-period values remain available; no comparison has been estimated."
                retry={() => void previous.refetch()}
                pending={previous.isFetching}
              />
            )}
            <DeliveryCharts report={current} />
          </>
        )
      )}
      <div className="grid min-w-0 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  Current zone workload
                </CardTitle>
                <DashboardInfo label="zone workload">
                  Current parcel statuses across all dates, independent of the
                  reporting period. In progress includes Assigned, PickedUp,
                  InTransit and OutForDelivery. Created parcels await
                  assignment; terminal outcomes are excluded. The chart shows
                  the six busiest zones.
                </DashboardInfo>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dispatch/zones">
                View zones
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            {workload.isPending ? (
              <WorkspaceLoading label="Loading zone workload..." />
            ) : workload.isError ? (
              <WorkspaceNotice
                destructive
                title="Zone workload unavailable"
                description="Snapshot counts could not be loaded."
                retry={() => void workload.refetch()}
                pending={workload.isFetching}
              />
            ) : (
              zones && (
                <>
                  <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/20 p-4">
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">
                        In progress
                      </dt>
                      <dd className="text-2xl font-semibold tabular-nums">
                        {zones
                          .reduce((sum, zone) => sum + zone.active, 0)
                          .toLocaleString()}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs text-muted-foreground">
                        Awaiting assignment
                      </dt>
                      <dd className="text-2xl font-semibold tabular-nums">
                        {zones
                          .reduce((sum, zone) => sum + zone.awaiting, 0)
                          .toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                  <WorkloadChart zones={zones} />
                </>
              )
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <Store
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Pending approvals
            </CardTitle>
            <DashboardInfo label="pending approvals">
              Current merchant applications awaiting review, independent of the
              reporting period. The oldest four are listed; the total includes
              all pending applications.
            </DashboardInfo>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            {merchants.isPending ? (
              <WorkspaceLoading label="Loading merchant approvals..." />
            ) : merchants.isError ? (
              <WorkspaceNotice
                destructive
                title="Merchant approvals unavailable"
                description="The pending count could not be verified."
                retry={() => void merchants.refetch()}
                pending={merchants.isFetching}
              />
            ) : (
              pending && (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-4">
                    <div>
                      <p className="text-3xl font-semibold tabular-nums">
                        {pending.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Awaiting review
                      </p>
                    </div>
                    <Clock3
                      className="size-6 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  {pending.length ? (
                    <ul className="divide-y">
                      {pending.slice(0, 4).map((business) => (
                        <li key={business.id} className="space-y-1 py-3">
                          <p className="break-words text-sm font-medium">
                            {business.businessName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Registered{' '}
                            {Number.isNaN(Date.parse(business.registeredAt))
                              ? 'date unavailable'
                              : formatReportDate(
                                  new Date(business.registeredAt)
                                    .toISOString()
                                    .slice(0, 10),
                                )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-4 text-sm text-muted-foreground">
                      No merchant applications awaiting review.
                    </p>
                  )}
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/admin/merchants">
                      Review approvals
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </AdminWorkspace>
  );
}
