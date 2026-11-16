import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
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

// Use the matrix's strongest background shades, rather than its text colors.
const config = {
  beforeTransit: {
    label: 'Before transit',
    theme: {
      light: 'var(--color-amber-200)',
      dark: 'color-mix(in oklab, var(--color-amber-900) 70%, transparent)',
    },
  },
  onRoad: {
    label: 'On the road',
    theme: {
      light: 'var(--color-sky-200)',
      dark: 'color-mix(in oklab, var(--color-sky-900) 70%, transparent)',
    },
  },
  done: {
    label: 'Done',
    theme: {
      light: 'var(--color-emerald-200)',
      dark: 'color-mix(in oklab, var(--color-emerald-900) 70%, transparent)',
    },
  },
  problems: {
    label: 'Problems',
    color: 'color-mix(in oklab, var(--destructive) 10%, transparent)',
  },
  other: { label: 'Other statuses', color: 'var(--muted)' },
} satisfies ChartConfig;

const segmentStrokes: Record<keyof typeof config, string> = {
  beforeTransit: 'stroke-amber-200 dark:stroke-amber-900',
  onRoad: 'stroke-sky-200 dark:stroke-sky-900',
  done: 'stroke-emerald-200 dark:stroke-emerald-900',
  problems: 'stroke-destructive/25',
  other: 'stroke-border',
};

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
  const [detailsTarget, setDetailsTarget] = useState<HTMLDivElement | null>(
    null,
  );
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
        className="aspect-auto h-96 w-full min-w-0 sm:h-80"
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
          {detailsTarget && (
            <ChartTooltip
              active
              defaultIndex={0}
              content={({ payload }) => {
                const zone = shown.find(
                  (zone) =>
                    zone.zoneId === payloadZoneId(payload?.[0]?.payload),
                );
                if (!zone) return null;
                // Keep Recharts' pointer/keyboard selection, render the text in
                // normal document flow rather than its floating tooltip box.
                return createPortal(
                  <div className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                    <p className="break-words sm:col-span-2">
                      <span className="font-medium">{zone.name}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · Total parcels: {formatZoneCount(zone.total).exact}
                      </span>
                    </p>
                    {model.groups.map((group) => (
                      <p key={group.label} className="break-words">
                        <span className="font-medium">
                          {group.label}:{' '}
                          {
                            formatZoneCount(
                              group.columns.reduce(
                                (sum, column) =>
                                  sum + (zone.statusCounts[column.key] ?? 0),
                                0,
                              ),
                            ).exact
                          }
                        </span>
                        <span className="text-muted-foreground">
                          {' '}
                          ·{' '}
                          {group.columns
                            .map(
                              ({ key, label }) =>
                                `${label}: ${formatZoneCount(zone.statusCounts[key] ?? 0).exact}`,
                            )
                            .join(' · ')}
                        </span>
                      </p>
                    ))}
                  </div>,
                  detailsTarget,
                );
              }}
            />
          )}
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
              className={segmentStrokes[key]}
              strokeWidth={1}
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
      <div
        ref={setDetailsTarget}
        role="status"
        aria-label="Zone workload details"
        aria-atomic="true"
        className="min-w-0"
      />
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
