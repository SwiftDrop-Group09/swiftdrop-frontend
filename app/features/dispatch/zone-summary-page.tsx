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

function ZoneSummaryContent() {
  const { user, session } = useIdentity();
  const query = useQuery({
    queryKey: ['dispatch-zone-summary', user!.id],
    queryFn: () => createAdminDeliveryApi(session).getZoneSummary(),
  });
  return (
    <WorkspacePage
      title="Zone summary"
      description="Review delivery volume and parcel status across your service zones."
      actions={
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
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Delivery volume by zone</CardTitle>
          <CardDescription>
            Current parcel counts from delivery operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <WorkspaceLoading label="Loading zone summary…" />
          ) : query.isError ? (
            <WorkspaceNotice
              destructive
              title="Unable to load zone summary"
              description="Check your connection and try again."
              retry={() => {
                void query.refetch();
              }}
              pending={query.isFetching}
            />
          ) : query.data.zones.length === 0 ? (
            <WorkspaceNotice
              title="No zone activity yet"
              description="Zone totals will appear as delivery operations records parcels."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead className="text-right">Total parcels</TableHead>
                  <TableHead>Status breakdown</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.zones.map((zone) => (
                  <TableRow key={zone.zoneId}>
                    <TableCell className="font-medium">{zone.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {zone.total}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {Object.entries(zone.statusCounts).map(
                          ([status, count]) => (
                            <span key={status}>
                              {status}: {count}
                            </span>
                          ),
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}

export function ZoneSummaryPage() {
  return (
    <IdentityShell>
      <Protected roles={['Dispatcher', 'Admin']}>
        <ZoneSummaryContent />
      </Protected>
    </IdentityShell>
  );
}
