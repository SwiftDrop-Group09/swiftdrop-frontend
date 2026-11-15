import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { AdminWorkspace } from '~/features/identity/admin-workspace';
import { IdentityShell, Protected } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import { AdminDeliveryError, createAdminDeliveryApi } from './api';
import { getUtcDatePreset, getUtcIsoRange } from './report-date-range';
import { deliveryReportCsv } from './report-export';
import { ReportPeriod } from './report-period';

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const displayDate = (value: string) =>
  new Intl.DateTimeFormat('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
export default function AdminReportsPage() {
  return (
    <IdentityShell>
      <Protected admin>
        <ReportContent />
      </Protected>
    </IdentityShell>
  );
}
function ReportContent() {
  const { session, user } = useIdentity();
  const api = useMemo(() => createAdminDeliveryApi(session), [session]);
  const [params] = useSearchParams();
  const [applied, setApplied] = useState(() => {
    const startDate = params.get('from') ?? '',
      endDate = params.get('through') ?? '';
    return getUtcIsoRange(startDate, endDate).isValid
      ? { startDate, endDate }
      : getUtcDatePreset(30);
  });
  const [dirty, setDirty] = useState(false);
  const [page, setPage] = useState(1);
  const range = getUtcIsoRange(applied.startDate, applied.endDate);
  const report = useQuery({
    queryKey: ['admin-delivery-report', user!.id, range.fromUtc, range.toUtc],
    queryFn: ({ signal }) =>
      api.getDeliveryReport(range.fromUtc, range.toUtc, signal),
    enabled: range.isValid,
    retry: false,
  });
  const data = !report.isError && !report.isPending ? report.data : undefined;
  function exportCsv() {
    if (!data || dirty || report.isFetching) return;
    const blob = new Blob([deliveryReportCsv(data)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `swiftdrop-delivery-report-${applied.startDate}-to-${applied.endDate}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  const stats = data
    ? [
        {
          label: 'Delivered',
          value: data.delivered.toLocaleString(),
          note: 'Successful outcomes',
        },
        {
          label: 'Failed',
          value: data.failed.toLocaleString(),
          note: 'Failed outcomes',
        },
        {
          label: 'Cancelled',
          value: data.cancelled.toLocaleString(),
          note: 'Excluded from rates',
        },
        {
          label: 'Terminal outcomes',
          value: data.terminalCount.toLocaleString(),
          note: 'Delivered + failed',
        },
        {
          label: 'Success rate',
          value: percent(data.successRate),
          note: data.terminalCount
            ? 'Of terminal outcomes'
            : 'No terminal outcomes',
        },
        {
          label: 'Failure rate',
          value: percent(data.failureRate),
          note: data.terminalCount
            ? 'Of terminal outcomes'
            : 'No terminal outcomes',
        },
      ]
    : [];
  return (
    <AdminWorkspace
      title="Delivery reports"
      actions={
        <>
          <ReportPeriod
            value={applied}
            onDraftChange={setDirty}
            onChange={(next) => {
              setApplied(next);
              setPage(1);
            }}
          />
          <Button
            variant="outline"
            disabled={report.isFetching || dirty}
            onClick={() => void report.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
          <Button
            variant="outline"
            disabled={!data || report.isFetching || dirty}
            onClick={exportCsv}
          >
            <Download aria-hidden="true" />
            Export CSV
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        {report.isFetching ? 'Loading' : 'Showing'}{' '}
        {displayDate(applied.startDate)} through {displayDate(applied.endDate)}{' '}
        (UTC)
      </p>
      {report.isPending ? (
        <WorkspaceLoading label="Loading delivery report..." />
      ) : report.isError ? (
        <WorkspaceNotice
          destructive
          title="Unable to load delivery report"
          description={
            report.error instanceof AdminDeliveryError
              ? report.error.message
              : 'Report records could not be loaded. Please try again.'
          }
          retry={() => void report.refetch()}
          pending={report.isFetching}
        />
      ) : (
        data && (
          <>
            <div
              className="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6"
              aria-label="Report summary"
            >
              {stats.map((stat) => (
                <Card key={stat.label} className="min-w-0">
                  <CardHeader className="gap-2 p-4 pb-2">
                    <CardDescription>{stat.label}</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {stat.value}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                    {stat.note}
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="min-w-0">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
                <CardTitle className="text-base">Daily breakdown</CardTitle>
                <Badge variant="outline">{data.days.length} days</Badge>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
                {!data.days.length ? (
                  <WorkspaceNotice
                    title="No delivery outcomes recorded"
                    description="No daily records were returned for the selected UTC period."
                  />
                ) : (
                  <Table className="min-w-[44rem]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date (UTC)</TableHead>
                        {[
                          'Delivered',
                          'Failed',
                          'Cancelled',
                          'Terminal',
                          'Success rate',
                          'Failure rate',
                        ].map((heading) => (
                          <TableHead key={heading} className="text-right">
                            {heading}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.days
                        .slice((page - 1) * 20, page * 20)
                        .map((day) => {
                          const terminal = day.delivered + day.failed;
                          return (
                            <TableRow key={day.date}>
                              <TableCell className="whitespace-nowrap font-medium">
                                <time dateTime={day.date}>
                                  {displayDate(day.date)}
                                </time>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {day.delivered}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {day.failed}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {day.cancelled}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {terminal}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {percent(
                                  terminal ? day.delivered / terminal : 0,
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {percent(terminal ? day.failed / terminal : 0)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of{' '}
                    {Math.max(1, Math.ceil(data.days.length / 20))}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page * 20 >= data.days.length}
                      onClick={() => setPage(page + 1)}
                    >
                      Next days
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )
      )}
    </AdminWorkspace>
  );
}
