import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { createAdminDeliveryApi } from '~/features/admin-delivery/api';
import { IdentityShell, Protected } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
import {
  ReportPeriod,
  formatReportDate,
  type ReportDates,
} from '~/shared/components/report-period';
import { getUtcIsoRange } from '~/shared/lib/report-date-range';
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
import { ZoneStatusMatrix } from './zone-status-matrix';

function ZoneSummaryContent() {
  const { user, session } = useIdentity();
  const [period, setPeriod] = useState<ReportDates | null>(null);
  const range = period
    ? getUtcIsoRange(period.startDate, period.endDate)
    : null;
  const query = useQuery({
    queryKey: range
      ? ['delivery-zone-summary', user!.id, range.fromUtc, range.toUtc]
      : ['delivery-zone-summary', user!.id],
    queryFn: ({ signal }) =>
      createAdminDeliveryApi(session).getZoneSummary(
        range?.fromUtc,
        range?.toUtc,
        signal,
      ),
  });
  const scope = period
    ? `Bookings from ${formatReportDate(period.startDate)} through ${formatReportDate(period.endDate)}.`
    : 'All booking dates.';
  return (
    <WorkspacePage
      title="Zone summary"
      actions={
        <>
          <ReportPeriod
            allowAllDates
            inputMode="calendar"
            showTimeZone={false}
            value={period}
            onChange={setPeriod}
          />
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        </>
      }
    >
      <Card className="min-w-0">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Delivery volume by zone</CardTitle>
          <CardDescription>
            {scope} Current parcel statuses, grouped by delivery zone. The
            period filters booking time.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          {query.isFetching && query.data && (
            <p role="status" className="text-sm text-muted-foreground">
              Refreshing zone summary…
            </p>
          )}
          {query.isError && (
            <WorkspaceNotice
              destructive
              title={
                query.data
                  ? 'Unable to refresh zone summary'
                  : 'Unable to load zone summary'
              }
              description={
                query.data
                  ? 'Showing previously loaded results for this period. Try again to get current counts.'
                  : 'Check your connection and try again.'
              }
              retry={() => {
                void query.refetch();
              }}
              pending={query.isFetching}
            />
          )}
          {query.isPending ? (
            <WorkspaceLoading label="Loading zone summary…" />
          ) : (
            query.data &&
            (query.data.zones.length === 0 ? (
              <WorkspaceNotice
                title="No delivery zones configured"
                description="There are no configured delivery zones to summarize."
              />
            ) : (
              <ZoneStatusMatrix zones={query.data.zones} />
            ))
          )}
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}

function AccountSummary() {
  const { user } = useIdentity();
  return <ZoneSummaryContent key={user!.id} />;
}

export function ZoneSummaryPage() {
  return (
    <IdentityShell>
      <Protected roles={['Dispatcher', 'Admin']}>
        <AccountSummary />
      </Protected>
    </IdentityShell>
  );
}
