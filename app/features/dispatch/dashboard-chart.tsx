import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
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
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '~/shared/components/ui/combobox';
import { WorkspaceNotice } from '~/shared/components/workspace-state';
import type { dispatchSnapshot } from './dashboard-analytics';
import { buildZoneMatrix, formatZoneCount } from './zone-matrix-model';
import { ZONE_STATUS_GROUPS } from './zone-status-groups';

// Use the requested shade 4 fills consistently in every appearance mode.
const config = {
  beforeTransit: {
    label: 'Before transit',
    color: 'var(--color-amber-200)',
  },
  onRoad: {
    label: 'On the road',
    color: 'var(--color-sky-200)',
  },
  done: {
    label: 'Done',
    color: 'var(--color-emerald-200)',
  },
  problems: {
    label: 'Problems',
    color: 'color-mix(in oklab, var(--brand-primary) 10%, transparent)',
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

type Workloads = ReturnType<typeof dispatchSnapshot>['workloads'];
export type ZoneWorkloadMode = (typeof ZONE_STATUS_GROUPS)[number]['key'];
export function defaultWorkloadMode(zones: Workloads): ZoneWorkloadMode {
  return (
    ZONE_STATUS_GROUPS.find((group) =>
      zones.some((zone) => zone[group.key] > 0),
    )?.key ?? 'beforeTransit'
  );
}
export function DispatchWorkloadModePicker({
  mode,
  onModeChange,
}: {
  mode: ZoneWorkloadMode;
  onModeChange: (value: ZoneWorkloadMode) => void;
}) {
  const selected = ZONE_STATUS_GROUPS.find((group) => group.key === mode)!;
  return (
    <Combobox<(typeof ZONE_STATUS_GROUPS)[number]>
      items={[...ZONE_STATUS_GROUPS]}
      value={selected}
      onValueChange={(value) => {
        if (value) onModeChange(value.key);
      }}
      itemToStringLabel={(group) => group.label}
    >
      <ComboboxInput
        aria-label="Zone workload mode"
        placeholder="Select workload mode"
        className="w-full sm:w-48"
      />
      <ComboboxContent>
        <ComboboxEmpty>No matching modes.</ComboboxEmpty>
        <ComboboxList>
          {(group: (typeof ZONE_STATUS_GROUPS)[number]) => (
            <ComboboxItem key={group.key} value={group}>
              {group.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
export function DispatchWorkloadChart({
  zones,
  mode = defaultWorkloadMode(zones),
}: {
  zones: Workloads;
  mode?: ZoneWorkloadMode;
}) {
  const populated = zones
    .filter((zone) => zone[mode] > 0)
    .sort(
      (a, b) =>
        b[mode] - a[mode] ||
        a.name.localeCompare(b.name) ||
        a.zoneId.localeCompare(b.zoneId),
    );
  const shown = populated.slice(0, 6);
  const label = config[mode].label;
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
          zones.some(
            (zone) =>
              zone.beforeTransit +
                zone.onRoad +
                zone.done +
                zone.problems +
                zone.other >
              0,
          )
            ? `No parcels in ${label}`
            : zones.some((zone) => zone.total > 0)
              ? 'No status breakdown available'
              : 'No parcels in configured zones'
        }
        description="Choose another mode or view zones for the complete status breakdown, including other returned statuses."
      />
    );
  return (
    <>
      <ChartContainer
        key={mode}
        config={config}
        className="aspect-auto h-96 w-full min-w-0 sm:h-80"
        role="region"
        aria-label="Current zone workload chart"
      >
        <BarChart
          accessibilityLayer
          data={shown}
          layout="vertical"
          margin={{ left: 0, right: 56 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis type="number" dataKey={mode} hide />
          <YAxis type="category" dataKey="name" hide />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="dot"
                className="max-w-64 break-words"
              />
            }
          />
          <Bar
            dataKey={mode}
            fill={`var(--color-${mode})`}
            className={segmentStrokes[mode]}
            strokeWidth={1}
            radius={4}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="name"
              position="insideLeft"
              offset={8}
              className="pointer-events-none fill-foreground stroke-background stroke-[3px] [paint-order:stroke]"
              fontSize={12}
              formatter={(value) => {
                const name = String(value);
                return name.length > 17 ? name.slice(0, 16) + '…' : name;
              }}
            />
            <LabelList
              dataKey={mode}
              content={({ viewBox, value }) => {
                if (
                  !viewBox ||
                  !('x' in viewBox) ||
                  !('width' in viewBox) ||
                  !('y' in viewBox) ||
                  !('height' in viewBox)
                )
                  return null;
                return (
                  <text
                    x={Math.max(
                      Number(viewBox.x) + Number(viewBox.width) + 8,
                      120,
                    )}
                    y={Number(viewBox.y) + Number(viewBox.height) / 2}
                    dominantBaseline="central"
                    className="pointer-events-none fill-foreground"
                    fontSize={12}
                  >
                    {formatZoneCount(Number(value)).display}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground">
        {shown.length} of {zones.length} zones · Ranked by {label}, highest
        first. Zero-count zones in this mode are omitted. View zones for all
        status counts.
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
