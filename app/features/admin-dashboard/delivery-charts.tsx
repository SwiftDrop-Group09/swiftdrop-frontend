import { DashboardInfo } from './dashboard-info';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '~/shared/components/ui/chart';
import { WorkspaceNotice } from '~/shared/components/workspace-state';
import type { DeliveryReportResponse } from '~/features/admin-delivery/contracts';
import { formatReportDate } from '~/features/admin-delivery/report-period';
import type { zoneWorkloads } from './analytics';

const outcomeConfig = {
  delivered: { label: 'Delivered', color: 'var(--chart-1)' },
  failed: { label: 'Failed', color: 'var(--chart-2)' },
  cancelled: { label: 'Cancelled', color: 'var(--chart-3)' },
} satisfies ChartConfig;
const workloadConfig = {
  active: { label: 'In progress', color: 'var(--chart-4)' },
  awaiting: { label: 'Awaiting assignment', color: 'var(--chart-5)' },
} satisfies ChartConfig;
export function DeliveryCharts({ report }: { report: DeliveryReportResponse }) {
  const outcomes = [
    {
      outcome: 'delivered',
      count: report.delivered,
      fill: 'var(--color-delivered)',
    },
    { outcome: 'failed', count: report.failed, fill: 'var(--color-failed)' },
    {
      outcome: 'cancelled',
      count: report.cancelled,
      fill: 'var(--color-cancelled)',
    },
  ];
  const hasOutcomes = report.delivered + report.failed + report.cancelled > 0;
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-3">
      <Card className="min-w-0 xl:col-span-2">
        <CardHeader className="space-y-1 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Daily delivery trend</CardTitle>
            <DashboardInfo label="daily delivery trend">
              Delivered, failed and cancelled transitions recorded on each UTC
              day in the selected period.
            </DashboardInfo>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          {!hasOutcomes ? (
            <WorkspaceNotice
              title="No delivery outcomes in this period"
              description="The selected period has no delivered, failed or cancelled transitions."
            />
          ) : (
            <ChartContainer
              config={outcomeConfig}
              className="h-72 w-full min-w-0 aspect-auto sm:h-80"
              role="region"
              aria-label="Daily delivery outcomes chart"
            >
              <AreaChart
                accessibilityLayer
                data={report.days}
                margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  tick={{ fill: 'var(--muted-foreground)' }}
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                  tickFormatter={(value) =>
                    typeof value === 'string'
                      ? formatReportDate(value).replace(/,? \d{4}$/, '')
                      : ''
                  }
                />
                <YAxis
                  tick={{ fill: 'var(--muted-foreground)' }}
                  width={36}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) =>
                        typeof label === 'string' ? formatReportDate(label) : ''
                      }
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  dataKey="delivered"
                  type="monotone"
                  stackId="outcomes"
                  stroke="var(--color-delivered)"
                  fill="var(--color-delivered)"
                  fillOpacity={0.25}
                  isAnimationActive={false}
                />
                <Area
                  dataKey="failed"
                  type="monotone"
                  stackId="outcomes"
                  stroke="var(--color-failed)"
                  fill="var(--color-failed)"
                  fillOpacity={0.2}
                  isAnimationActive={false}
                />
                <Area
                  dataKey="cancelled"
                  type="monotone"
                  stackId="outcomes"
                  stroke="var(--color-cancelled)"
                  fill="var(--color-cancelled)"
                  fillOpacity={0.15}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader className="space-y-1 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Outcome breakdown</CardTitle>
            <DashboardInfo label="outcome breakdown">
              Totals for the selected period. Success and failure rates use
              delivered plus failed as the denominator; cancellations are
              reported separately.
            </DashboardInfo>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          {hasOutcomes ? (
            <ChartContainer
              config={outcomeConfig}
              className="mx-auto h-48 w-full max-w-xs aspect-auto"
              role="region"
              aria-label="Delivery outcome breakdown chart"
            >
              <PieChart accessibilityLayer>
                <ChartTooltip
                  content={<ChartTooltipContent nameKey="outcome" hideLabel />}
                />
                <Pie
                  data={outcomes.filter((item) => item.count > 0)}
                  dataKey="count"
                  nameKey="outcome"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={3}
                  strokeWidth={0}
                  isAnimationActive={false}
                />
              </PieChart>
            </ChartContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No outcomes to chart.
            </p>
          )}
          <dl className="space-y-3 text-sm">
            {outcomes.map((item) => (
              <div
                key={item.outcome}
                className="flex items-center justify-between gap-3"
              >
                <dt className="text-muted-foreground">
                  {
                    outcomeConfig[item.outcome as keyof typeof outcomeConfig]
                      .label
                  }
                </dt>
                <dd className="font-medium tabular-nums">
                  {item.count.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkloadChart({
  zones,
}: {
  zones: ReturnType<typeof zoneWorkloads>;
}) {
  const shown = zones.slice(0, 6);
  return (
    <>
      {!shown.some((zone) => zone.active + zone.awaiting > 0) ? (
        <WorkspaceNotice
          title="No active zone workload"
          description="There are no in-progress parcels or parcels awaiting assignment in the returned zone snapshot."
        />
      ) : (
        <ChartContainer
          config={workloadConfig}
          className="h-72 w-full min-w-0 aspect-auto"
          role="region"
          aria-label="Current zone workload chart"
        >
          <BarChart
            accessibilityLayer
            data={shown}
            layout="vertical"
            margin={{ left: 0, right: 16 }}
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
                  ? value.slice(0, 16) + '...'
                  : String(value)
              }
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="active"
              stackId="workload"
              fill="var(--color-active)"
              radius={[0, 0, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="awaiting"
              stackId="workload"
              fill="var(--color-awaiting)"
              radius={[0, 3, 3, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      )}
      <p className="text-xs text-muted-foreground">
        {shown.length} of {zones.length} zones
      </p>
      <div className="sr-only">
        <Table>
          <caption>Zone workload chart values</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead>In progress</TableHead>
              <TableHead>Awaiting assignment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((zone) => (
              <TableRow key={zone.zoneId}>
                <TableCell>{zone.name}</TableCell>
                <TableCell>{zone.active}</TableCell>
                <TableCell>{zone.awaiting}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
