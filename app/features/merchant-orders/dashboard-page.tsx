import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { IdentityShell, Protected } from '../identity/components';
import {
  PARCEL_STATUSES,
  PARCEL_STATUS_LABELS,
} from '../customer-tracking/contracts';
import { StatusBadge } from '../customer-tracking/components';
import { WorkspacePage } from '~/shared/components/workspace-page';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import type { DashboardDays, MerchantDashboard } from './contracts';
import {
  presetRange,
  rangePresets,
  readDays,
  sameDays,
  validateDays,
} from './dashboard-range';
import { STALE_AFTER_MINUTES, useMerchantDashboard } from './hooks';
import {
  ApprovedBusinessGate,
  formatUtc,
  OrderStateBadge,
  TrackingLink,
} from './order-display';

export function DashboardPage() {
  return (
    <Protected roles={['Merchant']}>
      <IdentityShell>
        <WorkspacePage
          title="Business overview"
          description="Your orders and delivery results for a chosen period. Figures come from SwiftDrop's copy of your parcel statuses."
          actions={
            <Button asChild variant="outline">
              <Link to="/merchant/orders">
                <ClipboardList aria-hidden="true" />
                All orders
              </Link>
            </Button>
          }
        >
          <ApprovedBusinessGate feature="business statistics">
            <DashboardContent />
          </ApprovedBusinessGate>
        </WorkspacePage>
      </IdentityShell>
    </Protected>
  );
}

function DashboardContent() {
  const [params, setParams] = useSearchParams();
  const days = readDays(params, new Date());
  const dashboard = useMerchantDashboard(days, true);

  function choose(next: DashboardDays) {
    setParams({ from: next.fromDay, to: next.toDay });
  }

  return (
    <>
      <RangePicker days={days} onChoose={choose} />
      {dashboard.isPending ? (
        <WorkspaceLoading label="Loading business overview…" />
      ) : dashboard.isError ? (
        <WorkspaceNotice
          destructive
          title="Unable to load the business overview"
          description={dashboard.error.message}
          retry={() => void dashboard.refetch()}
          pending={dashboard.isFetching}
        />
      ) : (
        <DashboardFigures
          data={dashboard.data}
          loadedAt={dashboard.dataUpdatedAt}
          refreshing={dashboard.isFetching}
          onRefresh={() => void dashboard.refetch()}
        />
      )}
    </>
  );
}

function RangePicker({
  days,
  onChoose,
}: {
  days: DashboardDays;
  onChoose: (days: DashboardDays) => void;
}) {
  const [draft, setDraft] = useState(days);
  const [error, setError] = useState('');
  const now = new Date();

  // Keep the inputs in step when the range changes from a preset or the URL.
  const [shown, setShown] = useState(days);
  if (!sameDays(shown, days)) {
    setShown(days);
    setDraft(days);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Period</CardTitle>
        <CardDescription>
          UTC calendar days, both included. Up to 366 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="group"
          aria-label="Quick ranges"
          className="flex flex-wrap gap-2"
        >
          {rangePresets.map((preset) => {
            const range = presetRange(preset.days, now);
            const active = sameDays(range, days);
            return (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                onClick={() => {
                  setError('');
                  onChoose(range);
                }}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const problem = validateDays(draft);
            setError(problem);
            if (!problem) onChoose(draft);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="dashboard-from">From</Label>
            <Input
              id="dashboard-from"
              type="date"
              value={draft.fromDay}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  fromDay: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dashboard-to">To</Label>
            <Input
              id="dashboard-to"
              type="date"
              value={draft.toDay}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  toDay: event.target.value,
                }))
              }
            />
          </div>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function percent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function DashboardFigures({
  data,
  loadedAt,
  refreshing,
  onRefresh,
}: {
  data: MerchantDashboard;
  loadedAt: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const finished = data.terminalDeliveredCount + data.terminalFailedCount;

  return (
    <>
      <Freshness
        lastRefreshedAt={data.lastRefreshedAt}
        loadedAt={loadedAt}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      <section aria-labelledby="orders-heading" className="space-y-3">
        <h2 id="orders-heading" className="text-base font-semibold">
          Orders received in this period
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total orders" value={data.totalOrders} />
          <StatTile
            label="Being processed"
            value={data.pendingCount}
            hint="Received or retrying; no parcel yet"
          />
          <StatTile
            label="Active parcels"
            value={data.activeCount}
            hint="Created and not yet finished"
          />
          <StatTile
            label="Orders that failed"
            value={data.failedJobs}
            hint="No parcel could be created"
          />
        </dl>
      </section>

      <section aria-labelledby="outcomes-heading" className="space-y-3">
        <h2 id="outcomes-heading" className="text-base font-semibold">
          Deliveries finished in this period
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Delivered" value={data.terminalDeliveredCount} />
          <StatTile
            label="Delivery unsuccessful"
            value={data.terminalFailedCount}
          />
          <StatTile
            label="Success rate"
            value={finished > 0 ? percent(data.successRate) : '—'}
            hint={
              finished > 0
                ? `Failure rate ${percent(data.failureRate)}`
                : 'No deliveries finished in this period'
            }
          />
          <StatTile
            label="Cancelled"
            value={data.terminalCancelledCount}
            hint="Not counted in the rates"
          />
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatusBreakdown statusCounts={data.statusCounts} />
        <RecentOrders orders={data.recentOrders} />
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="text-3xl font-semibold tabular-nums tracking-tight">
          {value}
        </dd>
        {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
      </CardContent>
    </Card>
  );
}

/** Labels parcel data that was already old when it was loaded (no live clock in render). */
function Freshness({
  lastRefreshedAt,
  loadedAt,
  refreshing,
  onRefresh,
}: {
  lastRefreshedAt: string | null;
  /** When this dashboard response was received (ms since epoch). */
  loadedAt: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const ageMinutes = lastRefreshedAt
    ? (loadedAt - new Date(lastRefreshedAt).getTime()) / 60_000
    : null;
  const stale = ageMinutes !== null && ageMinutes > STALE_AFTER_MINUTES;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="text-sm text-muted-foreground">
        {lastRefreshedAt
          ? `Parcel statuses last refreshed ${formatUtc(lastRefreshedAt)}.`
          : 'No parcel statuses have been received yet.'}{' '}
        {stale && (
          <span className="font-medium text-foreground">
            They may be out of date.
          </span>
        )}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={refreshing}
        onClick={onRefresh}
      >
        <RefreshCw
          aria-hidden="true"
          className={refreshing ? 'animate-spin' : undefined}
        />
        Refresh
      </Button>
    </div>
  );
}

/**
 * One series (parcels per status) on one baseline: a single hue, horizontal
 * bars capped at 12px with rounded data-ends, the count printed after each bar
 * and every row readable as text — so it also serves as the table view.
 */
function StatusBreakdown({
  statusCounts,
}: {
  statusCounts: Record<string, number>;
}) {
  const rows = PARCEL_STATUSES.map((status) => ({
    status,
    count: statusCounts[status] ?? 0,
  }));
  const max = Math.max(...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parcels by status</CardTitle>
        <CardDescription>
          Current status of parcels for orders received in this period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No parcels were created for orders in this period.
          </p>
        ) : (
          <ul aria-label="Parcels by status" className="space-y-3">
            {rows.map(({ status, count }) => {
              const label = PARCEL_STATUS_LABELS[status];
              const share = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <li
                  key={status}
                  className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3"
                  title={`${label}: ${count} (${share}%)`}
                >
                  <span className="text-sm">{label}</span>
                  <span
                    aria-hidden="true"
                    className="h-3 rounded-r bg-muted/40"
                  >
                    {count > 0 && (
                      <span
                        className="block h-full rounded-r bg-primary"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    )}
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {count}
                    <span className="sr-only"> parcels</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentOrders({
  orders,
}: {
  orders: MerchantDashboard['recentOrders'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent orders</CardTitle>
        <CardDescription>
          The latest orders received in this period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No orders were received in this period.
          </p>
        ) : (
          <ul aria-label="Recent orders" className="divide-y">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 space-y-1">
                  <Link
                    to={`/merchant/orders/${order.id}`}
                    className="block break-all font-mono text-sm underline-offset-4 hover:underline"
                  >
                    {order.externalOrderId}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatUtc(order.createdAt)}
                    {order.trackingNumber && (
                      <>
                        {' · '}
                        <TrackingLink code={order.trackingNumber} />
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <OrderStateBadge state={order.state} />
                  {order.parcelStatus && (
                    <StatusBadge status={order.parcelStatus} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
