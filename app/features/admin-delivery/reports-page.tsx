import { AdminWorkspace } from '~/features/identity/admin-workspace';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Ban,
  Package,
} from 'lucide-react';
import { useIdentity } from '~/features/identity/session';
import { IdentityShell, Protected } from '~/features/identity/components';
import {
  createAdminDeliveryApi,
  AdminDeliveryError,
} from '~/features/admin-delivery/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '~/shared/components/ui/card';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Badge } from '~/shared/components/ui/badge';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '~/shared/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';

function getUtcIsoRange(
  startStr: string,
  endStr: string,
): { fromUtc?: string; toUtc?: string; isValid: boolean } {
  if (
    !startStr ||
    !endStr ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startStr) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endStr)
  ) {
    return { isValid: false };
  }
  try {
    const fromDate = new Date(`${startStr}T00:00:00Z`);
    const endDate = new Date(`${endStr}T00:00:00Z`);
    if (isNaN(fromDate.getTime()) || isNaN(endDate.getTime())) {
      return { isValid: false };
    }
    // Add 1 day to end date to make it inclusive of the selected day
    const toDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    return {
      fromUtc: fromDate.toISOString(),
      toUtc: toDate.toISOString(),
      isValid: toDate > fromDate,
    };
  } catch {
    return { isValid: false };
  }
}

export default function AdminReportsRoute() {
  const { session, user, restoring } = useIdentity();
  const enabled = !restoring && !!user?.roles.includes('Admin');
  const api = useMemo(() => createAdminDeliveryApi(session), [session]);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgoStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [startDate, setStartDate] = useState(sevenDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);

  const { fromUtc, toUtc, isValid } = useMemo(
    () => getUtcIsoRange(startDate, endDate),
    [startDate, endDate],
  );

  const reportQuery = useQuery({
    queryKey: ['admin-delivery-report', user?.id, fromUtc, toUtc],
    queryFn: () =>
      fromUtc && toUtc
        ? api.getDeliveryReport(fromUtc, toUtc)
        : Promise.reject(new Error('Invalid dates')),
    enabled: enabled && Boolean(isValid && fromUtc && toUtc),
  });

  function setPreset(days: number) {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    setStartDate(start);
    setEndDate(end);
  }

  function exportCsv() {
    if (!reportQuery.data || typeof window === 'undefined') return;
    const report = reportQuery.data;
    const rows = [
      [
        'Date',
        'Delivered',
        'Failed',
        'Cancelled',
        'Terminal Total',
        'Success Rate',
      ],
      ...report.days.map((d) => {
        const term = d.delivered + d.failed;
        const rate =
          term > 0 ? ((d.delivered / term) * 100).toFixed(2) + '%' : '0.00%';
        return [d.date, d.delivered, d.failed, d.cancelled, term, rate];
      }),
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `swiftdrop-delivery-report-${startDate}-to-${endDate}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <IdentityShell>
      <Protected admin>
        <AdminWorkspace
          title="Delivery Performance Reports"
          description="System delivery outcomes, success/failure rates, and terminal history across UTC windows."
          actions={
            <>
              {' '}
              {reportQuery.data && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCsv}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              )}{' '}
            </>
          }
        >
          {/* Date Range Selection Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Report Date Window (UTC)
              </CardTitle>
              <CardDescription>
                Select predefined presets or choose custom dates (maximum 366
                days).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreset(1)}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreset(7)}
                  >
                    Last 7 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreset(30)}
                  >
                    Last 30 Days
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="fromInput" className="text-xs font-medium">
                      From:
                    </Label>
                    <Input
                      id="fromInput"
                      type="date"
                      className="h-8 text-xs w-36"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="toInput" className="text-xs font-medium">
                      To:
                    </Label>
                    <Input
                      id="toInput"
                      type="date"
                      className="h-8 text-xs w-36"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {!isValid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Invalid Date Window</AlertTitle>
              <AlertDescription>
                Please ensure both dates are valid and the end date is greater
                than or equal to the start date.
              </AlertDescription>
            </Alert>
          )}

          {reportQuery.isError && (
            <WorkspaceNotice
              title="Error Loading Report"
              destructive
              pending={reportQuery.isFetching}
              retry={() => {
                void reportQuery.refetch();
              }}
              description={
                reportQuery.error instanceof AdminDeliveryError
                  ? reportQuery.error.message
                  : 'Failed to retrieve delivery reports. Please verify the date parameters and try again.'
              }
            />
          )}

          {reportQuery.isLoading && isValid && (
            <WorkspaceLoading label="Generating system delivery report..." />
          )}

          {/* High-level KPI Cards using shadcn Card */}
          {reportQuery.data && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="border-green-100 dark:border-green-950">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Delivered
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold text-foreground">
                      {reportQuery.data.delivered}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                    Completed successfully
                  </CardContent>
                </Card>

                <Card className="border-red-100 dark:border-red-950">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <XCircle className="h-3.5 w-3.5" />
                      Failed
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold text-foreground">
                      {reportQuery.data.failed}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                    Terminal failures
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
                      <Package className="h-3.5 w-3.5 text-primary" />
                      Terminal Total
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold">
                      {reportQuery.data.terminalCount}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                    Delivered + Failed
                  </CardContent>
                </Card>

                <Card className="border-green-100 dark:border-green-950">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Success Rate
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold text-foreground">
                      {(reportQuery.data.successRate * 100).toFixed(1)}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                    Of terminal deliveries
                  </CardContent>
                </Card>

                <Card className="border-red-100 dark:border-red-950">
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Failure Rate
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold text-foreground">
                      {(reportQuery.data.failureRate * 100).toFixed(1)}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                    Of terminal deliveries
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardDescription className="flex items-center gap-1.5 text-xs font-medium">
                      <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                      Cancelled
                    </CardDescription>
                    <CardTitle className="text-2xl font-bold text-muted-foreground">
                      {reportQuery.data.cancelled}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                    Excluded from rate
                  </CardContent>
                </Card>
              </div>

              {/* Daily Breakdown Table using shadcn Card and Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-lg">
                      Daily Delivery Breakdown
                    </CardTitle>
                    <CardDescription>
                      Distribution of completed and failed deliveries per UTC
                      calendar day.
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {reportQuery.data.days.length} Days Recorded
                  </Badge>
                </CardHeader>
                <CardContent>
                  {reportQuery.data.days.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No delivery status changes were recorded within this time
                      window.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date (UTC)</TableHead>
                          <TableHead className="text-right">
                            Delivered
                          </TableHead>
                          <TableHead className="text-right">Failed</TableHead>
                          <TableHead className="text-right">
                            Cancelled
                          </TableHead>
                          <TableHead className="text-right">
                            Terminal Outcomes
                          </TableHead>
                          <TableHead className="text-right">
                            Success Rate
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportQuery.data.days.map((d) => {
                          const terminal = d.delivered + d.failed;
                          const rate =
                            terminal > 0 ? (d.delivered / terminal) * 100 : 0;
                          return (
                            <TableRow key={d.date}>
                              <TableCell className="font-mono font-medium">
                                {d.date}
                              </TableCell>
                              <TableCell className="text-right text-foreground font-semibold">
                                {d.delivered}
                              </TableCell>
                              <TableCell className="text-right text-foreground font-semibold">
                                {d.failed}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {d.cancelled}
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                {terminal}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant={
                                    rate >= 90
                                      ? 'default'
                                      : rate > 0
                                        ? 'secondary'
                                        : 'outline'
                                  }
                                >
                                  {rate.toFixed(1)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </AdminWorkspace>
      </Protected>
    </IdentityShell>
  );
}
