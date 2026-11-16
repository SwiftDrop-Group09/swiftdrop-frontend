import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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

const config = {
  awaiting: { label: 'Awaiting assignment', color: 'var(--chart-1)' },
  active: { label: 'In progress', color: 'var(--chart-4)' },
} satisfies ChartConfig;

export function DispatchWorkloadChart({
  zones,
}: {
  zones: ReturnType<typeof dispatchSnapshot>['workloads'];
}) {
  const shown = zones.slice(0, 6);
  if (!zones.length)
    return (
      <WorkspaceNotice
        title="No delivery zones configured"
        description="Zone workload will appear when delivery zones are configured."
      />
    );
  if (!shown.some((zone) => zone.active + zone.awaiting > 0))
    return (
      <WorkspaceNotice
        title="No active zone workload"
        description="There are no parcels awaiting assignment or in progress in the returned zone snapshot."
      />
    );
  return (
    <>
      <ChartContainer
        config={config}
        className="aspect-auto h-80 w-full min-w-0"
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
          />
          <YAxis
            tick={{ fill: 'var(--muted-foreground)' }}
            type="category"
            dataKey="name"
            width={110}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              typeof value === 'string' && value.length > 17
                ? value.slice(0, 16) + '…'
                : String(value)
            }
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend
            content={
              <ChartLegendContent className="flex-wrap gap-x-4 gap-y-2" />
            }
          />
          <Bar
            dataKey="awaiting"
            stackId="workload"
            fill="var(--color-awaiting)"
            isAnimationActive={false}
          />
          <Bar
            dataKey="active"
            stackId="workload"
            fill="var(--color-active)"
            radius={[0, 3, 3, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
      <p className="text-xs text-muted-foreground">
        {shown.length} of {zones.length} zones · Ranked by awaiting assignment
        plus in progress.
      </p>
      <div className="sr-only">
        <Table>
          <caption>Zone workload chart values</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead>Awaiting assignment</TableHead>
              <TableHead>In progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((zone) => (
              <TableRow key={zone.zoneId}>
                <TableCell>{zone.name}</TableCell>
                <TableCell>{zone.awaiting}</TableCell>
                <TableCell>{zone.active}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
