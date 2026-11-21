import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  ExternalLink,
  Layers,
  MapPin,
  Package,
  Phone,
  Receipt,
  Shield,
  ShieldCheck,
  Sliders,
  Terminal,
  Truck,
} from 'lucide-react';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import {
  StatusBadge,
  formatDateTime,
  formatMoney,
} from '~/features/customer-tracking/components';
import {
  CustomerJourney,
  DeliveryRoute,
} from '~/features/customer-tracking/customer-presentation';
import type { ParcelStatus } from '~/features/customer-tracking/contracts';
import type {
  AdminOverviewCardData,
  AdminReportCardData,
  AdminTariffsCardData,
  AssistantToolCallTrace,
  CourierAssignmentsCardData,
  CourierDutyCardData,
  CourierProtocolCardData,
  CourierWorkSummaryCardData,
  DeliveryTimeEstimateCardData,
  DispatcherQueueCardData,
  CourierWorkloadCardData,
  MerchantIntegrationCardData,
  MerchantOrdersCardData,
  ParcelListCardData,
  QuoteCardData,
  TrackingCardData,
  ZoneDispatchCardData,
  ZonesCardData,
} from './contracts';

// -------------------------------------------------------------
// 1. Tool Execution Trace Pill / Inspector
// -------------------------------------------------------------

export function ToolTraceBadge({ trace }: { trace: AssistantToolCallTrace }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1.5 rounded-md border border-border/60 bg-muted/20 text-xs transition-colors">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            tool:{' '}
            <strong className="font-semibold text-foreground">
              {trace.toolName}
            </strong>
          </span>
          <span className="text-muted-foreground/70 font-normal">
            ({trace.durationMs}ms)
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={
              trace.status === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] px-1.5 py-0 font-sans'
                : 'border-destructive/30 bg-destructive/10 text-destructive text-[10px] px-1.5 py-0 font-sans'
            }
          >
            {trace.status}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-3 py-2 space-y-2 text-foreground">
          {trace.arguments ? (
            <div>
              <p className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
                Input Arguments
              </p>
              <pre className="max-h-36 overflow-auto rounded bg-background/80 p-2 font-mono text-[11px] leading-relaxed border">
                {JSON.stringify(trace.arguments, null, 2)}
              </pre>
            </div>
          ) : null}
          {trace.summary ? (
            <div>
              <p className="font-semibold text-muted-foreground text-[10px] uppercase tracking-wider mb-1">
                Execution Summary
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {trace.summary}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// 2. Interactive Tracking Result Card
// -------------------------------------------------------------

export function TrackingResultCard({ data }: { data: TrackingCardData }) {
  const isDelivered = data.status.toLowerCase() === 'delivered';
  const detailUrl = data.parcelId
    ? `/customer/parcels/${data.parcelId}`
    : `/track?code=${encodeURIComponent(data.trackingNumber)}`;
  const receiptUrl = data.parcelId
    ? `/customer/parcels/${data.parcelId}/receipt`
    : `/track?code=${encodeURIComponent(data.trackingNumber)}`;

  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs transition-all hover:border-primary/40">
      <CardHeader className="bg-muted/30 p-3.5 sm:p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <CardTitle className="font-mono text-sm sm:text-base font-bold">
              {data.trackingNumber}
            </CardTitle>
          </div>
          <StatusBadge status={data.status as ParcelStatus} />
        </div>
        <div className="pt-2">
          <DeliveryRoute
            pickup={data.originCity}
            delivery={data.destinationCity}
            compact
          />
        </div>
      </CardHeader>

      <CardContent className="p-3.5 sm:p-4 pt-3 space-y-3">
        {/* Customer Progress Bar Journey */}
        <CustomerJourney status={data.status as ParcelStatus} compact />
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/10 p-3 sm:px-4">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Updated {formatDateTime(data.lastUpdatedAt)}</span>
          {data.isPublic && (
            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
              Public tracking view
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.canViewReceipt && isDelivered && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
            >
              <Link to={receiptUrl}>
                <Receipt className="h-3.5 w-3.5" />
                <span>View Receipt</span>
              </Link>
            </Button>
          )}
          <Button asChild size="sm" className="h-8 text-xs gap-1">
            <Link to={detailUrl}>
              <span>Open live tracker</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// -------------------------------------------------------------
// 3. Instant Fee Estimate Card
// -------------------------------------------------------------

export function QuoteResultCard({ data }: { data: QuoteCardData }) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs transition-all hover:border-primary/40">
      <CardHeader className="bg-muted/30 p-3.5 sm:p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm sm:text-base font-bold">
              {data.pickupCity} → {data.deliveryCity}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {data.weightKg} kg · {data.size} Tier
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-primary text-xs"
          >
            Tariff {data.pricingVersion}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 sm:p-4">
        <div className="flex items-baseline justify-between rounded-lg bg-muted/40 p-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium">
              Estimated Total
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatMoney(data.total, data.currency)}
            </p>
          </div>
          {data.expiresAt && (
            <div className="text-right text-xs text-muted-foreground">
              <span className="block font-medium">Quote Valid Until</span>
              <span>{formatDateTime(data.expiresAt)}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/10 p-3 sm:px-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Server-verified rate</span>
        </div>
        <Button asChild size="sm" className="h-8 text-xs gap-1 font-semibold">
          <Link to={data.bookingDeepLink}>
            <span>Book this delivery</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// -------------------------------------------------------------
// 4. Customer Parcels Summary Card
// -------------------------------------------------------------

export function ParcelListResultCard({
  data,
  onSelectParcel,
}: {
  data: ParcelListCardData;
  onSelectParcel?: (trackingNumber: string) => void;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Your Active & Recent Parcels ({data.totalCount})
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Showing {data.parcels.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {data.parcels.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No parcels found in your customer account.
          </div>
        ) : (
          data.parcels.map((parcel) => (
            <div
              key={parcel.trackingNumber}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-foreground">
                    {parcel.trackingNumber}
                  </span>
                  <StatusBadge status={parcel.status as ParcelStatus} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {parcel.route} • {parcel.weightKg} kg ({parcel.size})
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onSelectParcel && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onSelectParcel(parcel.trackingNumber)}
                  >
                    Ask about this
                  </Button>
                )}
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                >
                  <Link
                    to={
                      parcel.parcelId
                        ? `/customer/parcels/${parcel.parcelId}`
                        : `/track?code=${parcel.trackingNumber}`
                    }
                  >
                    Track
                  </Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 5. Service Zones Result Card
// -------------------------------------------------------------

export function ZonesResultCard({ data }: { data: ZonesCardData }) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <CardTitle className="text-sm font-semibold">
          SwiftDrop Delivery Service Zones ({data.zones.length})
        </CardTitle>
        <CardDescription className="text-xs">
          Active geographic coverage for standard and express delivery across
          Sri Lanka.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {data.supportedCities.map((city) => (
            <Badge key={city} variant="secondary" className="text-xs">
              <MapPin className="mr-1 h-3 w-3 text-primary" />
              {city}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 5b. Delivery Time Estimate Result Card
// -------------------------------------------------------------

export function DeliveryTimeResultCard({
  data,
}: {
  data: DeliveryTimeEstimateCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <span>Estimated Delivery Transit Time</span>
          </CardTitle>
          <Badge
            variant={data.serviceSpeed === 'Express' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {data.serviceSpeed}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Sri Lanka province & zone transit SLA estimate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-3.5 sm:p-4">
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 p-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Transit Route
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>{data.pickupCity}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{data.deliveryCity}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Est. Duration
            </span>
            <p className="text-sm font-bold text-primary">
              {data.estimatedDuration}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-border/40 p-2.5 space-y-1">
            <span className="text-[11px] text-muted-foreground">
              Estimated Arrival
            </span>
            <p className="font-medium text-foreground">
              {data.estimatedDeliveryDate}
            </p>
          </div>
          <div className="rounded-md border border-border/40 p-2.5 space-y-1">
            <span className="text-[11px] text-muted-foreground">
              Route Classification
            </span>
            <p className="font-medium text-foreground">{data.routeType}</p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground italic">
          {data.cutoffTime}
        </p>
      </CardContent>
      <CardFooter className="bg-muted/10 p-3 pt-0 flex justify-end gap-2">
        <Button asChild size="sm" variant="default" className="text-xs">
          <Link
            to={`/customer/book?pickupCity=${encodeURIComponent(data.pickupCity)}&deliveryCity=${encodeURIComponent(data.deliveryCity)}`}
          >
            Book This Delivery
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// -------------------------------------------------------------
// 6. Courier Assignments Card
// -------------------------------------------------------------

export function CourierAssignmentsResultCard({
  data,
}: {
  data: CourierAssignmentsCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            <span>Assigned Deliveries ({data.totalCount})</span>
          </CardTitle>
          <Badge variant="outline" className="text-xs font-mono">
            {data.serviceDate}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Scheduled package dropoffs assigned to your active courier run.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border/50 p-0">
        {data.assignments.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No assigned deliveries currently pending.
          </p>
        ) : (
          data.assignments.map((item) => (
            <div
              key={item.trackingNumber}
              className="flex flex-col gap-1.5 p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-foreground">
                    {item.trackingNumber}
                  </span>
                  <StatusBadge
                    status={(item.status ?? 'Booked') as ParcelStatus}
                  />
                  <Badge variant="secondary" className="text-[10px]">
                    {item.weightKg} kg
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-0.5">
                  <span className="font-medium text-foreground">
                    {item.recipientName}
                  </span>{' '}
                  • {item.dropoffAddress}, {item.dropoffCity}
                </p>
                {item.recipientPhone && (
                  <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="size-3 text-muted-foreground" />
                    <span>{item.recipientPhone}</span>
                  </p>
                )}
              </div>
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
              >
                <Link to="/courier">Open Manifest</Link>
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 7. Courier Work Summary Card
// -------------------------------------------------------------

export function CourierWorkSummaryResultCard({
  data,
}: {
  data: CourierWorkSummaryCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <span>Courier Shift Work Summary</span>
          </CardTitle>
          <Badge variant="outline" className="text-xs font-mono">
            {data.serviceDate}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3.5 sm:p-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Active Load</p>
          <p className="text-base font-bold text-foreground mt-0.5">
            {data.active}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Delivered</p>
          <p className="text-base font-bold text-emerald-600 mt-0.5">
            {data.delivered}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Failed Attempts</p>
          <p className="text-base font-bold text-amber-600 mt-0.5">
            {data.failed}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Overdue</p>
          <p className="text-base font-bold text-rose-600 mt-0.5">
            {data.overdueCount}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 8. Courier Duty Status Card
// -------------------------------------------------------------

export function CourierDutyResultCard({ data }: { data: CourierDutyCardData }) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardContent className="p-3.5 sm:p-4 flex items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge
              variant={data.onDuty ? 'default' : 'secondary'}
              className="text-xs"
            >
              {data.onDuty ? 'ON DUTY' : 'OFF DUTY'}
            </Badge>
            <span className="font-semibold text-foreground">
              {data.vehicleType ?? 'Standard Vehicle'}
            </span>
          </div>
          <p className="text-muted-foreground">
            Vehicle: {data.vehicleNumber ?? 'Unregistered'} • Max payload:{' '}
            {data.maxWeightKg} kg
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to="/courier">Toggle Duty</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 9. Courier Delivery Protocol Card
// -------------------------------------------------------------

export function CourierProtocolResultCard({
  data,
}: {
  data: CourierProtocolCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <span>{data.title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3.5 sm:p-4 space-y-2 text-xs">
        <div className="space-y-1.5">
          {data.steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2 text-foreground">
              <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{step}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground border border-border/50">
          <strong>Policy Note:</strong> {data.exceptionGuidelines}
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 10. Dispatcher Unassigned Queue Card
// -------------------------------------------------------------

export function DispatcherQueueResultCard({
  data,
}: {
  data: DispatcherQueueCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <span>Unassigned Parcels ({data.totalUnassigned})</span>
          </CardTitle>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to="/dispatch/unassigned">Manage Queue</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border/50 p-0 text-xs">
        {data.parcels.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No unassigned parcels waiting in queue.
          </p>
        ) : (
          data.parcels.map((p) => (
            <div
              key={p.parcelId}
              className="flex items-center justify-between p-3"
            >
              <div>
                <span className="font-mono font-semibold text-foreground">
                  {p.trackingNumber}
                </span>
                <p className="text-muted-foreground mt-0.5">
                  {p.pickupCity} → {p.deliveryCity} • {p.weightKg} kg ({p.size})
                </p>
              </div>
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
              >
                <Link to="/dispatch/unassigned">Assign</Link>
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 11. Courier Workload Card
// -------------------------------------------------------------

export function CourierWorkloadResultCard({
  data,
}: {
  data: CourierWorkloadCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            <span>Fleet Workload ({data.totalCouriers} Total)</span>
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {data.activeCouriersOnDuty} On Duty
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border/50 p-0 text-xs">
        {data.couriers.map((c) => (
          <div
            key={c.courierId}
            className="flex items-center justify-between p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {c.courierCode}
                </span>
                <Badge
                  variant={c.onDuty ? 'default' : 'secondary'}
                  className="text-[10px]"
                >
                  {c.onDuty ? 'On-Duty' : 'Off-Duty'}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-0.5">
                {c.vehicleType} • Capacity: {c.activeCount}/{c.capacity} parcels
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link to="/dispatch/workload">Details</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 12. Zone Dispatch Summary Card
// -------------------------------------------------------------

export function ZoneDispatchResultCard({
  data,
}: {
  data: ZoneDispatchCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <span>Zone Dispatch Summary</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3.5 sm:p-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        {data.zones.map((z) => (
          <div key={z.zoneName} className="rounded-lg border bg-card p-2.5">
            <span className="font-semibold text-foreground">{z.zoneName}</span>
            <p className="text-muted-foreground mt-0.5">
              {z.pendingPickups} pending parcels
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 13. Merchant Orders Card
// -------------------------------------------------------------

export function MerchantOrdersResultCard({
  data,
}: {
  data: MerchantOrdersCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="size-4 text-primary" />
            <span>Commercial Merchant Orders ({data.totalOrders})</span>
          </CardTitle>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to="/merchant/orders">All Orders</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border/50 p-0 text-xs">
        {data.orders.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">
            No merchant orders registered yet.
          </p>
        ) : (
          data.orders.map((o) => (
            <div
              key={o.trackingNumber}
              className="flex items-center justify-between p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-foreground">
                    {o.trackingNumber}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {o.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-0.5">
                  Ref: {o.externalOrderId ?? 'N/A'} → {o.recipientCity} (
                  {o.weightKg} kg)
                </p>
              </div>
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
              >
                <Link to="/merchant/orders">View</Link>
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 14. Merchant Integration Card
// -------------------------------------------------------------

export function MerchantIntegrationResultCard({
  data,
}: {
  data: MerchantIntegrationCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Code2 className="size-4 text-primary" />
          <span>API & Webhook Integration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3.5 sm:p-4 space-y-2 text-xs">
        <div className="space-y-1">
          <span className="font-semibold text-foreground">REST Endpoint:</span>
          <p className="font-mono text-[11px] bg-muted/60 p-1.5 rounded border">
            {data.endpoint} ({data.apiBaseUrl})
          </p>
        </div>
        <div className="space-y-1">
          <span className="font-semibold text-foreground">
            Supported Webhook Events:
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.webhookEvents.map((evt) => (
              <Badge
                key={evt}
                variant="secondary"
                className="text-[10px] font-mono"
              >
                {evt.split(' ')[0]}
              </Badge>
            ))}
          </div>
        </div>
        <div className="pt-2 flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to="/merchant">API Keys</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to="/merchant/webhooks">Webhooks</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 15. Admin Delivery Report Card
// -------------------------------------------------------------

export function AdminReportResultCard({ data }: { data: AdminReportCardData }) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <span>Delivery Performance KPIs (30 Days)</span>
          </CardTitle>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to="/admin/reports">Full Report</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3.5 sm:p-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Total Parcels</p>
          <p className="text-base font-bold text-foreground mt-0.5">
            {data.totalTerminal}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Success Rate</p>
          <p className="text-base font-bold text-emerald-600 mt-0.5">
            {(data.successRate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Delivered</p>
          <p className="text-base font-bold text-foreground mt-0.5">
            {data.delivered}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Failed Rate</p>
          <p className="text-base font-bold text-rose-600 mt-0.5">
            {(data.failureRate * 100).toFixed(1)}%
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 16. Admin Pricing Tariffs Card
// -------------------------------------------------------------

export function AdminTariffsResultCard({
  data,
}: {
  data: AdminTariffsCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sliders className="size-4 text-primary" />
            <span>Pricing Tariffs Schedule ({data.totalTiers})</span>
          </CardTitle>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to="/admin/pricing">Manage Tariffs</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border/50 p-0 text-xs">
        {data.tiers.slice(0, 5).map((t, idx) => (
          <div key={idx} className="flex items-center justify-between p-3">
            <div>
              <span className="font-semibold text-foreground">
                {t.zoneName} ({t.size})
              </span>
              <p className="text-muted-foreground mt-0.5">
                Base: {t.currency} {t.baseRate.toFixed(2)} + {t.currency}{' '}
                {t.perKgRate.toFixed(2)}/kg
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {t.pricingVersion}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------
// 17. Admin Overview Card
// -------------------------------------------------------------

export function AdminOverviewResultCard({
  data,
}: {
  data: AdminOverviewCardData;
}) {
  return (
    <Card className="my-2.5 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="size-4 text-primary" />
          <span>Platform Operational Overview</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3.5 sm:p-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Parcels Today</p>
          <p className="text-base font-bold text-foreground mt-0.5">
            {data.totalParcelsToday}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Unassigned</p>
          <p className="text-base font-bold text-amber-600 mt-0.5">
            {data.unassignedParcels}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Active Couriers</p>
          <p className="text-base font-bold text-emerald-600 mt-0.5">
            {data.activeCouriersOnDuty}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2.5">
          <p className="text-muted-foreground">Active Zones</p>
          <p className="text-base font-bold text-foreground mt-0.5">
            {data.activeZonesCount}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
