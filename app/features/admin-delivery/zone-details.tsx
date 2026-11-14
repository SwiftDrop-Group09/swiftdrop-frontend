import { useMemo } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '~/features/identity/session';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Button } from '~/shared/components/ui/button';
import { Badge } from '~/shared/components/ui/badge';
import { createAdminDeliveryApi } from './api';
import type { Zone } from './contracts';
export function ZoneDetails({ zone }: { zone: Zone }) {
  const { session, user } = useIdentity();
  const api = useMemo(() => createAdminDeliveryApi(session), [session]);
  const load = useQuery({
    queryKey: ['delivery-zone-summary', user!.id],
    queryFn: () => api.getZoneSummary(),
    retry: false,
  });
  const pricing = useQuery({
    queryKey: ['admin-pricing', user!.id, zone.id],
    queryFn: () => api.listPricingTiers(1, 20, zone.id),
    retry: false,
  });
  const summary = load.data?.zones.find((item) => item.zoneId === zone.id);
  return (
    <div className="grid min-w-0 gap-6 bg-muted/20 p-4 sm:p-6 lg:grid-cols-3">
      <section className="min-w-0 space-y-3" aria-label="Full postal coverage">
        <h3 className="font-semibold">Postal coverage</h3>
        <p className="text-sm text-muted-foreground">
          {zone.servicePostalCodes.length} configured codes
        </p>
        <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
          {zone.servicePostalCodes.map((code) => (
            <Badge key={code} variant="outline">
              {code}
            </Badge>
          ))}
        </div>
        {!zone.servicePostalCodes.length && (
          <p className="text-sm text-muted-foreground">
            No postal codes assigned.
          </p>
        )}
        <p className="break-all text-xs text-muted-foreground">
          Zone ID: {zone.id}
        </p>
        <p className="text-xs text-muted-foreground">
          Saved version: {zone.version}
        </p>
      </section>
      <section className="min-w-0 space-y-3" aria-label="Zone workload">
        <h3 className="font-semibold">Recorded workload</h3>
        <p className="text-xs text-muted-foreground">
          All dates. Status totals describe recorded parcels.
        </p>
        {load.isPending ? (
          <WorkspaceLoading label="Loading zone workload..." />
        ) : load.isError ? (
          <WorkspaceNotice
            destructive
            title="Workload unavailable"
            description="Configuration remains available."
            retry={() => void load.refetch()}
          />
        ) : summary ? (
          <>
            <p className="text-2xl font-semibold tabular-nums">
              {summary.total}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                parcels
              </span>
            </p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(summary.statusCounts).map(([status, count]) => (
                <div
                  key={status}
                  className="flex flex-wrap justify-between gap-2 rounded-md border bg-background p-2"
                >
                  <dt className="text-muted-foreground">
                    {status.replace(/([a-z])([A-Z])/g, '$1 $2')}
                  </dt>
                  <dd className="font-medium tabular-nums">{count}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No workload summary returned for this zone.
          </p>
        )}
      </section>
      <section className="min-w-0 space-y-3" aria-label="Zone pricing">
        <h3 className="font-semibold">Associated pricing</h3>
        {pricing.isPending ? (
          <WorkspaceLoading label="Loading zone pricing..." />
        ) : pricing.isError ? (
          <WorkspaceNotice
            destructive
            title="Pricing unavailable"
            description="Retry to inspect this zone's tariffs."
            retry={() => void pricing.refetch()}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {pricing.data.totalCount} configured tiers
            </p>
            {!pricing.data.items.length && (
              <p className="text-sm text-muted-foreground">
                No pricing configured. An active tariff is required for booking.
              </p>
            )}
            {pricing.data.items.slice(0, 3).map((tier) => (
              <div
                key={tier.id}
                className="space-y-1 rounded-md border bg-background p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{tier.size}</span>
                  <Badge variant={tier.isActive ? 'secondary' : 'outline'}>
                    {tier.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  LKR {tier.baseRate.toFixed(2)} base +{' '}
                  {tier.perKgRate.toFixed(2)}/kg
                </p>
                <p className="break-words text-xs text-muted-foreground">
                  {tier.pricingVersion}
                </p>
              </div>
            ))}
            {pricing.data.totalCount > 3 && (
              <p className="text-xs text-muted-foreground">
                Showing the first 3 tiers from the first pricing page.
              </p>
            )}
          </>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to={`/admin/pricing?zoneId=${encodeURIComponent(zone.id)}`}>
            Manage zone pricing
          </Link>
        </Button>
      </section>
    </div>
  );
}
