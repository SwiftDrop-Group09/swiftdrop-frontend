import { Badge } from '~/shared/components/ui/badge';
import { cn } from '~/shared/lib/utils';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Package,
  PackageCheck,
  RefreshCw,
  Truck,
  TriangleAlert,
  ArrowRight,
} from 'lucide-react';
import { useState } from 'react';
import { useIdentity } from '~/features/identity/session';
import { WorkspacePage } from '~/shared/components/workspace-page';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Button } from '~/shared/components/ui/button';
import { Card } from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Progress } from '~/shared/components/ui/progress';
import { CourierApi } from './api';

export default function CourierDashboard() {
  const { user, session } = useIdentity();
  const [date, setDate] = useState('');
  const api = new CourierApi(session.authenticatedRequest, session.api.base);
  const q = useQuery({
    queryKey: [
      'courier',
      `${user!.id}:Courier`,
      'summary',
      date,
      true,
      '',
      false,
    ],
    queryFn: () => api.summary(date),
    enabled: user?.roles[0] === 'Courier',
  });
  const day = q.data?.day;
  function queue(status = '', history = false, overdueOnly = false) {
    const params = new URLSearchParams();
    if (date || q.data?.serviceDate)
      params.set('date', date || q.data!.serviceDate);
    if (!history && !overdueOnly) params.set('includeOverdue', 'false');
    if (status) params.set('status', status);
    if (overdueOnly) params.set('overdueOnly', 'true');
    return `${history ? '/courier/history' : '/courier'}${params.size ? `?${params}` : ''}`;
  }
  return (
    <WorkspacePage
      title="Today's work"
      actions={
        <Button
          variant="outline"
          disabled={q.isFetching}
          onClick={() => void q.refetch()}
        >
          <RefreshCw aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <Card className="gap-4 border-primary/20 bg-primary/5 p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays
                className="size-5 text-primary"
                aria-hidden="true"
              />
              Your delivery day
            </h2>
            <p className="text-sm text-muted-foreground">
              {q.data?.serviceDate ?? 'Service day'} · Asia/Colombo
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Label className="grid gap-2">
              Service date
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Label>
            <Button variant="outline" onClick={() => setDate('')}>
              Today
            </Button>
            <Button asChild>
              <Link to={queue()}>
                Open deliveries
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
      {q.isPending ? (
        <WorkspaceLoading label="Loading your day's work..." />
      ) : q.isError ? (
        <WorkspaceNotice
          title="Unable to load your day's work"
          description="Your workload could not be verified. Try refreshing."
          retry={() => void q.refetch()}
        />
      ) : (
        day && (
          <>
            <Card className="gap-4 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Service-day progress</h2>
                <span className="text-sm text-muted-foreground">
                  {day.completed} of {day.total} resolved
                </span>
              </div>
              <Progress
                value={day.total ? (day.completed / day.total) * 100 : 0}
                aria-label="Service-day completion"
              />
              <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  {day.delivered} delivered · {day.failed} failed · {day.active}{' '}
                  remaining
                </span>
                <span>Overdue work is tracked separately</span>
              </div>
            </Card>
            <section
              className="space-y-4"
              aria-labelledby="courier-priority-heading"
            >
              <h2
                id="courier-priority-heading"
                className="text-lg font-semibold"
              >
                Needs attention
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    label: 'Overdue active work',
                    count: q.data.overdueCount,
                    Icon: Clock3,
                    to: queue('', false, true),
                    overdue: true,
                  },
                  {
                    label: 'Out for delivery',
                    count: day.outForDelivery,
                    Icon: Truck,
                    to: queue('OutForDelivery'),
                    overdue: false,
                  },
                  {
                    label: 'Awaiting pickup',
                    count: day.assigned,
                    Icon: PackageCheck,
                    to: queue('Assigned'),
                    overdue: false,
                  },
                ].map(({ label, count, Icon, to, overdue }) => (
                  <Card
                    key={label}
                    className={cn(
                      'gap-4 p-4 sm:p-6',
                      count > 0 &&
                        (overdue
                          ? 'border-destructive/30 bg-destructive/5'
                          : 'border-primary bg-primary text-primary-foreground'),
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{label}</p>
                      <Icon
                        className={cn(
                          'size-5 shrink-0',
                          overdue && count > 0 && 'text-destructive',
                        )}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-3xl font-semibold tabular-nums">
                        {count}
                      </p>
                      <Badge
                        variant={
                          overdue && count > 0 ? 'destructive' : 'secondary'
                        }
                      >
                        {count > 0 ? 'Action needed' : 'Up to date'}
                      </Badge>
                    </div>
                    <Button asChild variant="ghost" className="justify-between">
                      <Link to={to}>
                        Open queue
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
            <section
              className="space-y-4"
              aria-labelledby="courier-overview-heading"
            >
              <h2
                id="courier-overview-heading"
                className="text-lg font-semibold"
              >
                Day overview
              </h2>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
                {[
                  {
                    label: 'Scheduled workload',
                    count: day.total,
                    Icon: Package,
                    to: queue(),
                  },
                  {
                    label: 'Picked up',
                    count: day.pickedUp,
                    Icon: CheckCircle2,
                    to: queue('PickedUp'),
                  },
                  {
                    label: 'In transit',
                    count: day.inTransit,
                    Icon: Truck,
                    to: queue('InTransit'),
                  },
                  {
                    label: 'Delivered',
                    count: day.delivered,
                    Icon: CheckCircle2,
                    to: queue('Delivered', true),
                  },
                  {
                    label: 'Failed',
                    count: day.failed,
                    Icon: TriangleAlert,
                    to: queue('Failed', true),
                  },
                ].map(({ label, count, Icon, to }) => (
                  <Card key={label} className="gap-3 p-4 sm:p-5">
                    <div className="flex justify-between gap-2">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <Icon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {count}
                    </p>
                    <Button
                      asChild
                      variant={to.includes('/history') ? 'link' : 'ghost'}
                      className="h-auto justify-start p-0 text-xs sm:text-sm"
                    >
                      <Link to={to}>
                        {to.includes('/history')
                          ? 'View history'
                          : 'Open queue'}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
            {day.total === 0 && (
              <WorkspaceNotice
                title="No deliveries scheduled for this day"
                description={
                  q.data.overdueCount
                    ? 'You still have overdue active deliveries. Open that queue to continue your work.'
                    : 'New assignments will appear here when the dispatch team schedules them.'
                }
              />
            )}
          </>
        )
      )}
    </WorkspacePage>
  );
}
