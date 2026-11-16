import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { parcelStatusBadgeClasses } from '~/features/customer-tracking/components';
import { Badge } from '~/shared/components/ui/badge';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '~/shared/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import { WorkspaceNotice } from '~/shared/components/workspace-state';
import type { dispatchSnapshot } from './dashboard-analytics';
import { buildZoneMatrix, formatZoneCount } from './zone-matrix-model';
import { ZONE_STATUS_GROUPS } from './zone-status-groups';

// Match the matrix's status text colors with solid, theme-aware chart fills.
const config = {
  beforeTransit: {
    label: 'Before transit',
    theme: { light: 'var(--color-amber-800)', dark: 'var(--color-amber-300)' },
  },
  onRoad: {
    label: 'On the road',
    theme: { light: 'var(--color-sky-800)', dark: 'var(--color-sky-300)' },
  },
  done: {
    label: 'Done',
    theme: {
      light: 'var(--color-emerald-800)',
      dark: 'var(--color-emerald-300)',
    },
  },
  problems: { label: 'Problems', color: 'var(--destructive)' },
  other: { label: 'Other statuses', color: 'var(--muted-foreground)' },
} satisfies ChartConfig;

function payloadZoneId(value: unknown) {
  return typeof value === 'object' && value !== null && 'zoneId' in value
    ? value.zoneId
    : undefined;
}

export function DispatchWorkloadChart({
  zones,
}: {
  zones: ReturnType<typeof dispatchSnapshot>['workloads'];
}) {
  const populated = zones.filter(
    (zone) =>
      zone.beforeTransit +
        zone.onRoad +
        zone.done +
        zone.problems +
        zone.other >
      0,
  );
  const shown = populated.slice(0, 6);
  const series = [
    ...ZONE_STATUS_GROUPS.map(({ key }) => key),
    ...(zones.some((zone) => zone.other > 0) ? (['other'] as const) : []),
  ];
  const model = buildZoneMatrix(shown);
  if (!zones.length)
    return (
      <WorkspaceNotice
        title="No delivery zones configured"
        description="Zone workload will appear when delivery zones are configured."
      />
    );
  if (!shown.length)
    return (
      <WorkspaceNotice
        title={
          zones.some((zone) => zone.total > 0)
            ? 'No status breakdown available'
            : 'No parcels in configured zones'
        }
        description="No positive status counts were returned. View zones for the configured zones and their reported totals."
      />
    );
  return (
    <>
      <ChartContainer
        config={config}
        className="aspect-auto h-96 w-full min-w-0 sm:h-80 [&_.recharts-tooltip-wrapper]:z-50"
        role="region"
        aria-label="Current zone workload chart"
      >
        <BarChart
          accessibilityLayer
          data={shown}
          layout="vertical"
          margin={{ left: 0, right: 12 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis
            tick={{ fill: 'var(--muted-foreground)' }}
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
            tickFormatter={(value: number) => formatZoneCount(value).display}
          />
          <YAxis
            tick={{ fill: 'var(--muted-foreground)' }}
            type="category"
            dataKey="name"
            width={100}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              typeof value === 'string' && value.length > 14
                ? value.slice(0, 13) + '…'
                : String(value)
            }
          />
          <ChartTooltip
            content={({ active, payload }) => {
              const zone = shown.find(
                (zone) => zone.zoneId === payloadZoneId(payload?.[0]?.payload),
              );
              if (!zone) return null;
              return (
                <ChartTooltipContent
                  active={active}
                  payload={payload}
                  className="w-64 max-w-[calc(100vw-2rem)]"
                  labelFormatter={() =>
                    zone && (
                      <div className="space-y-1 whitespace-normal break-words">
                        <p>{zone.name}</p>
                        <p className="font-normal text-muted-foreground">
                          Total parcels: {formatZoneCount(zone.total).exact}
                        </p>
                      </div>
                    )
                  }
                  formatter={(value, name) => {
                    const group = ZONE_STATUS_GROUPS.find(
                      (group) => group.key === name,
                    );
                    const columns = group
                      ? model.columns.filter((column) =>
                          group.statuses.some(
                            (status) => status === column.key,
                          ),
                        )
                      : model.groups.find(
                          (group) => group.label === 'Other statuses',
                        )?.columns;
                    return (
                      <div className="grid w-full gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={
                              group &&
                              parcelStatusBadgeClasses(group.statuses[0])
                            }
                          >
                            {group?.label ?? 'Other statuses'}
                          </Badge>
                          <span className="font-medium tabular-nums">
                            {typeof value === 'number'
                              ? formatZoneCount(value).exact
                              : String(value)}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed whitespace-normal break-words text-muted-foreground">
                          {columns
                            ?.map(
                              ({ key, label }) =>
                                `${label}: ${formatZoneCount(zone?.statusCounts[key] ?? 0).exact}`,
                            )
                            .join(' · ')}
                        </p>
                      </div>
                    );
                  }}
                />
              );
            }}
          />
          <ChartLegend
            itemSorter={null}
            content={
              <ChartLegendContent className="flex-wrap gap-x-3 gap-y-2" />
            }
          />
          {series.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="workload"
              fill={`var(--color-${key})`}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground">
        {shown.length} of {zones.length} zones · Ranked by Booked + Delivery
        unsuccessful + Cancelled, highest first. Zero-count zones are omitted.
        View zones for all status counts.
      </p>
      <div className="sr-only">
        <Table>
          <caption>Zone workload chart values</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Zone</TableHead>
              {model.columns.map(({ key, label }) => (
                <TableHead key={key} scope="col">
                  {label}
                </TableHead>
              ))}
              <TableHead scope="col">Total parcels</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((zone) => (
              <TableRow key={zone.zoneId}>
                <TableHead scope="row">{zone.name}</TableHead>
                {model.columns.map(({ key }) => (
                  <TableCell key={key}>
                    {formatZoneCount(zone.statusCounts[key] ?? 0).exact}
                  </TableCell>
                ))}
                <TableCell>{formatZoneCount(zone.total).exact}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
