import { useId } from 'react';
import { statusShades } from './zone-status-shades';
import type { ZoneSummaryResponse } from '~/features/admin-delivery/contracts';
import type { ParcelStatus } from '~/features/customer-tracking/contracts';
import { parcelStatusBadgeClasses } from '~/features/customer-tracking/components';
import { Badge } from '~/shared/components/ui/badge';
import { ScrollArea } from '~/shared/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/shared/components/ui/tooltip';
import { cn } from '~/shared/lib/utils';
import {
  buildZoneMatrix,
  formatZoneCount,
  zoneCountShade,
} from './zone-matrix-model';

const neutralShades = [
  'border-transparent bg-muted/30 text-muted-foreground',
  'border-border bg-muted/30 text-foreground',
  'border-border bg-muted/50 text-foreground',
  'border-border bg-muted/70 text-foreground',
  'border-border bg-muted text-foreground',
];

function countBadgeClasses(
  status: ParcelStatus | undefined,
  shade: number | undefined,
) {
  if (shade === undefined) return 'border-transparent font-semibold';
  if (shade === 0 || status === undefined) return neutralShades[shade];
  return cn(parcelStatusBadgeClasses(status), statusShades[status][shade - 1]);
}

function CountBadge({
  count,
  label,
  shade,
  status,
}: {
  count: number;
  label: string;
  shade?: number;
  status?: ParcelStatus;
}) {
  const value = formatZoneCount(count);
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'flex min-h-7 w-full justify-center rounded-md px-2 py-1 text-xs font-medium tabular-nums',
        countBadgeClasses(status, shade),
        value.compact &&
          'cursor-help focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
      )}
      tabIndex={value.compact ? 0 : undefined}
      role={value.compact ? 'group' : undefined}
      aria-label={
        value.compact ? `${label}, ${value.exact} parcels` : undefined
      }
    >
      {count === 0 ? (
        <>
          <span aria-hidden="true">—</span>
          <span className="sr-only">0</span>
        </>
      ) : (
        value.display
      )}
    </Badge>
  );
  if (!value.compact) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-64 break-words">
        {label} · {value.exact} parcels
      </TooltipContent>
    </Tooltip>
  );
}

export function ZoneStatusMatrix({
  zones,
}: {
  zones: ZoneSummaryResponse['zones'];
}) {
  const id = useId();
  const model = buildZoneMatrix(zones);
  return (
    <div className="min-w-0 space-y-3">
      <ScrollArea
        type="always"
        scrollbarOrientation="horizontal"
        className="w-full rounded-md border"
        viewportProps={{
          role: 'region',
          'aria-label': 'Zone status matrix scroll area',
          'aria-describedby': `${id}-help`,
          tabIndex: 0,
        }}
      >
        <Table
          aria-label="Zone status matrix"
          className="min-w-[54rem]"
          containerClassName="overflow-visible pb-3"
        >
          <TableCaption className="sr-only">
            Current parcel statuses by delivery zone
          </TableCaption>
          <TableHeader className="sticky top-0 z-20 bg-card">
            <TableRow>
              <TableHead
                scope="col"
                rowSpan={2}
                id={`${id}-zone`}
                className="sticky left-0 z-30 w-40 min-w-40 max-w-48 bg-card px-3 text-foreground"
              >
                Zone
              </TableHead>
              {model.groups.map((group, index) => (
                <TableHead
                  key={group.label}
                  scope="colgroup"
                  colSpan={group.columns.length}
                  id={`${id}-group-${index}`}
                  className="h-auto px-1 pt-2 pb-1 text-center"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      'w-full justify-center rounded-md',
                      group.columns[0]?.status &&
                        parcelStatusBadgeClasses(group.columns[0].status),
                    )}
                  >
                    {group.label}
                  </Badge>
                </TableHead>
              ))}
              <TableHead
                scope="col"
                rowSpan={2}
                id={`${id}-total`}
                className="min-w-24 px-2 text-center text-xs"
              >
                Total parcels
              </TableHead>
            </TableRow>
            <TableRow>
              {model.columns.map(({ key, label }, index) => (
                <TableHead
                  key={key}
                  scope="col"
                  id={`${id}-status-${index}`}
                  className="h-auto min-w-20 px-2 py-3 text-center text-xs whitespace-normal"
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.rows.map((zone) => (
              <TableRow key={zone.zoneId}>
                <TableHead
                  scope="row"
                  id={`${id}-row-${zone.zoneId}`}
                  className="sticky left-0 z-10 h-auto w-40 min-w-40 max-w-48 bg-card px-3 py-2 text-xs font-medium break-words text-foreground"
                >
                  {zone.name}
                </TableHead>
                {model.columns.map(({ key, label, status }, index) => {
                  const count = zone.statusCounts[key] ?? 0;
                  return (
                    <TableCell
                      key={key}
                      headers={`${id}-row-${zone.zoneId} ${id}-status-${index}`}
                      className="px-1 py-1"
                    >
                      <CountBadge
                        count={count}
                        label={`${zone.name} · ${label}`}
                        shade={zoneCountShade(count, model.maxima[key]!)}
                        status={status}
                      />
                    </TableCell>
                  );
                })}
                <TableCell
                  headers={`${id}-row-${zone.zoneId} ${id}-total`}
                  className="px-2 py-1"
                >
                  <CountBadge
                    count={zone.total}
                    label={`${zone.name} · Total parcels`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        Stronger shading means a higher count within each status column. — means
        zero. Zones are ordered by Booked + Delivery unsuccessful + Cancelled,
        highest first. Scroll horizontally to view all statuses on smaller
        screens.
      </p>
    </div>
  );
}
