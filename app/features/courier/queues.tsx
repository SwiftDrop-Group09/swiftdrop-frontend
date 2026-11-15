import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search, Clock3 } from 'lucide-react';
import { WorkspacePage } from '~/shared/components/workspace-page';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Button } from '~/shared/components/ui/button';
import { Card } from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Checkbox } from '~/shared/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '~/shared/components/ui/tabs';
import { Badge } from '~/shared/components/ui/badge';
import { useCourier } from './context';
import type { Assigned, Summary } from './api';
const isAssigned = (value: Summary): value is Assigned => 'recipient' in value;
import { CourierReadFailure } from './read-failure';
import { AssignmentCard, HistoryCard, statusLabel } from './presentation';

const activeStages = [
  'Assigned',
  'PickedUp',
  'InTransit',
  'OutForDelivery',
] as const;
const terminalStages = ['Delivered', 'Failed'] as const;
export function Manifest() {
  return <Queue history={false} />;
}
export function History() {
  return <Queue history />;
}

function Queue({ history }: { history: boolean }) {
  const { api, scope } = useCourier();
  const [params, setParams] = useSearchParams();
  const stages = history ? terminalStages : activeStages;
  const rawStatus = params.get('status') ?? '';
  const status = stages.find((s) => s === rawStatus) ?? '';
  const date = params.get('date') ?? '';
  const search = (params.get('search') ?? '').slice(0, 100);
  const overdueOnly = params.get('overdueOnly') === 'true';
  const includeOverdue = params.get('includeOverdue') !== 'false';
  const rawPage = Number(params.get('page') ?? 1);
  const page =
    Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000
      ? rawPage
      : 1;
  function change(values: Record<string, string>, paging = false) {
    const next = new URLSearchParams(params);
    if (!paging) next.delete('page');
    for (const [key, value] of Object.entries(values))
      if (value) next.set(key, value);
      else next.delete(key);
    setParams(next, {
      replace: Object.keys(values).every((key) => key === 'search'),
    });
  }
  const filters = { status, search, overdueOnly };
  const q = useQuery({
    queryKey: [
      'courier',
      scope,
      history ? 'history' : 'manifest',
      date,
      includeOverdue,
      filters,
      page,
    ],
    queryFn: () =>
      history
        ? api.history(page, { status, date, search })
        : api.manifest(date, includeOverdue, page, filters),
  });
  const counts = useQuery({
    queryKey: [
      'courier',
      scope,
      'summary',
      date,
      includeOverdue,
      search,
      overdueOnly,
    ],
    queryFn: () => api.summary(date, includeOverdue, { search, overdueOnly }),
    enabled: !history,
  });
  const workload = useQuery({
    queryKey: ['courier', scope, 'summary', date, true, '', false],
    queryFn: () => api.summary(date, true),
    enabled: !history,
  });
  const overdueCount = workload.data?.overdueCount;
  return (
    <WorkspacePage
      title={history ? 'Delivery history' : 'Assigned deliveries'}
      actions={
        <div className="flex flex-wrap gap-2">
          {!history && (
            <Button
              variant={includeOverdue ? 'default' : 'outline'}
              aria-pressed={includeOverdue}
              onClick={() =>
                change({
                  includeOverdue: String(!includeOverdue),
                  overdueOnly: '',
                })
              }
            >
              <Clock3 aria-hidden="true" />
              Include overdue
              <Badge
                variant={
                  !includeOverdue && (overdueCount ?? 0) > 0
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {overdueCount ?? '?'}
              </Badge>
            </Button>
          )}

          <Button asChild variant="ghost">
            <Link to={history ? '/courier' : '/courier/history'}>
              {history ? 'Active deliveries' : 'Delivery history'}
            </Link>
          </Button>
          <Button
            variant="outline"
            disabled={q.isFetching || (!history && counts.isFetching)}
            onClick={() => {
              void q.refetch();
              if (!history) {
                void counts.refetch();
                void workload.refetch();
              }
            }}
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        </div>
      }
    >
      {!history && !includeOverdue && (overdueCount ?? 0) > 0 && (
        <Card className="flex flex-col justify-between gap-3 border-destructive/25 bg-destructive/5 p-4 sm:flex-row sm:items-center">
          <p className="text-sm">
            <strong>{overdueCount} overdue deliveries</strong> are excluded from
            this view.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              change({
                includeOverdue: 'true',
                overdueOnly: 'true',
                search: '',
                status: '',
              })
            }
          >
            View overdue work
          </Button>
        </Card>
      )}
      <Card className="gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <Label className="grid gap-2">
            Service date
            <Input
              type="date"
              value={date}
              onChange={(e) => change({ date: e.target.value })}
            />
          </Label>
          <Button variant="outline" onClick={() => change({ date: '' })}>
            {history ? 'All dates' : 'Today'}
          </Button>
          <Label className="grid min-w-0 flex-1 gap-2 sm:min-w-56">
            <span className="flex items-center gap-2">
              <Search className="size-4" aria-hidden="true" />
              Find a delivery
            </span>
            <Input
              type="search"
              maxLength={100}
              placeholder="Tracking number"
              value={search}
              onChange={(e) => change({ search: e.target.value })}
            />
          </Label>
          {!history && (
            <div className="flex flex-wrap items-center gap-4 pb-2">
              <Label className="flex items-center gap-2">
                <Checkbox
                  disabled={!includeOverdue}
                  checked={overdueOnly}
                  onCheckedChange={(v) =>
                    change({ overdueOnly: v === true ? 'true' : '' })
                  }
                />
                Overdue only
              </Label>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {history
            ? 'Completed and failed assignments. Recipient details remain private after completion.'
            : 'Service days follow Asia/Colombo time. Overdue work keeps its original service date.'}
        </p>
      </Card>
      <Tabs
        value={status || 'all'}
        onValueChange={(v) => change({ status: v === 'all' ? '' : v })}
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max">
            <TabsTrigger value="all">
              {history ? 'All outcomes' : 'All active'}
              {!history && counts.data && (
                <Badge variant="secondary">{counts.data.queues.active}</Badge>
              )}
            </TabsTrigger>
            {stages.map((stage) => (
              <TabsTrigger key={stage} value={stage}>
                {statusLabel(stage)}
                {!history && counts.data && (
                  <Badge variant="secondary">
                    {
                      counts.data.queues[
                        stage === 'Assigned'
                          ? 'assigned'
                          : stage === 'PickedUp'
                            ? 'pickedUp'
                            : stage === 'InTransit'
                              ? 'inTransit'
                              : 'outForDelivery'
                      ]
                    }
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      {!history && counts.isError && (
        <CourierReadFailure
          error={counts.error}
          retry={() => void counts.refetch()}
        />
      )}
      {q.isPending ? (
        <WorkspaceLoading
          label={
            history ? 'Loading history...' : 'Loading assigned deliveries...'
          }
        />
      ) : q.isError ? (
        <CourierReadFailure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            {q.data.totalCount} {history ? 'finished' : 'matching'} deliveries
            {!history && counts.data
              ? ` · ${counts.data.overdueCount} overdue across your active workload`
              : ''}
          </p>
          {!q.data.items.length && (
            <WorkspaceNotice
              title="No deliveries match these filters."
              description="Choose another date, status or tracking number."
            />
          )}
          <ul
            data-testid="courier-parcels"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {q.data.items.map((d) => (
              <li key={d.id} className="min-w-0">
                {isAssigned(d) ? (
                  <AssignmentCard delivery={d} />
                ) : (
                  <HistoryCard delivery={d} />
                )}
              </li>
            ))}
          </ul>
          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <span className="text-sm text-muted-foreground">
              Page {page} of{' '}
              {Math.max(1, Math.ceil(q.data.totalCount / q.data.pageSize))}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => change({ page: String(page - 1) }, true)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page * q.data.pageSize >= q.data.totalCount}
                onClick={() => change({ page: String(page + 1) }, true)}
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      )}
    </WorkspacePage>
  );
}
