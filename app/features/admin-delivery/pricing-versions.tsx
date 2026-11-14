import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CopyPlus } from 'lucide-react';
import { useIdentity } from '~/features/identity/session';
import { Button } from '~/shared/components/ui/button';
import { Badge } from '~/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { createAdminDeliveryApi } from './api';
import { formatRate } from './pricing-editor';
import type { PricingTier, PricingZoneOverview } from './contracts';

export function PricingVersions({
  zone,
  onNewVersion,
  onStatus,
}: {
  zone: PricingZoneOverview;
  onNewVersion: (button: HTMLButtonElement, tier: PricingTier) => void;
  onStatus: (button: HTMLButtonElement, tier: PricingTier) => void;
}) {
  const { session, user } = useIdentity();
  const api = useMemo(() => createAdminDeliveryApi(session), [session]);
  const [page, setPage] = useState(1);
  const versions = useQuery({
    queryKey: ['admin-pricing', user!.id, 'versions', zone.zoneId, page],
    queryFn: ({ signal }) =>
      api.listPricingTiers(page, 20, zone.zoneId, signal),
    retry: false,
  });
  return (
    <div
      role="region"
      className="min-w-0 space-y-4 bg-muted/20 p-4 sm:p-6"
      aria-label={`Pricing versions for ${zone.zoneName}`}
    >
      <div className="space-y-1">
        <h3 className="font-semibold">Versions and availability</h3>
        <p className="text-sm text-muted-foreground">
          Rates are retained for each version. Activating one replaces the
          active version for the same parcel size.
        </p>
      </div>
      {versions.isPending ? (
        <WorkspaceLoading label="Loading pricing versions..." />
      ) : versions.isError ? (
        <WorkspaceNotice
          destructive
          title="Unable to load pricing versions"
          description="The zone's active rate overview remains available."
          retry={() => void versions.refetch()}
          pending={versions.isFetching}
        />
      ) : (
        <>
          {!versions.data.items.length ? (
            <p className="text-sm text-muted-foreground">
              No pricing versions configured for this zone.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcel size</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Base (LKR)</TableHead>
                  <TableHead className="text-right">Additional / kg</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.data.items.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell>
                      <Badge variant="outline">{tier.size}</Badge>
                    </TableCell>
                    <TableCell className="max-w-40 whitespace-normal break-all">
                      {tier.pricingVersion}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRate(tier.baseRate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRate(tier.perKgRate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tier.isActive ? 'secondary' : 'outline'}>
                        {tier.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Create new version for ${tier.zoneName} ${tier.size} ${tier.pricingVersion}`}
                          onClick={(event) =>
                            onNewVersion(event.currentTarget, tier)
                          }
                        >
                          <CopyPlus aria-hidden="true" />
                          New version
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`${tier.isActive ? 'Deactivate' : 'Activate'} ${tier.zoneName} ${tier.size} ${tier.pricingVersion}`}
                          onClick={(event) =>
                            onStatus(event.currentTarget, tier)
                          }
                        >
                          {tier.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {versions.data.totalCount} versions / Page {page} of{' '}
              {Math.max(1, Math.ceil(versions.data.totalCount / 20))}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page === 1 || versions.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Previous versions
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  page * 20 >= versions.data.totalCount || versions.isFetching
                }
                onClick={() => setPage(page + 1)}
              >
                Next versions
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
