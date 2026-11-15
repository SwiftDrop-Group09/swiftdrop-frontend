import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  Receipt,
  ShieldCheck,
  Zap,
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
import type { ParcelStatus } from '~/features/customer-tracking/contracts';
import type {
  AssistantToolCallTrace,
  ParcelListCardData,
  QuoteCardData,
  TrackingCardData,
  ZonesCardData,
} from './contracts';

// -------------------------------------------------------------
// 1. Tool Execution Trace Pill / Inspector
// -------------------------------------------------------------

export function ToolTraceBadge({ trace }: { trace: AssistantToolCallTrace }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs transition-all">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 text-left font-mono font-medium text-primary hover:opacity-80"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500" />
          <span className="truncate">
            MCP Tool:{' '}
            <strong className="font-semibold">{trace.toolName}</strong>
          </span>
          <span className="text-muted-foreground font-normal">
            ({trace.durationMs}ms)
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={
              trace.status === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0'
                : 'border-destructive/30 bg-destructive/10 text-destructive text-[10px] px-1.5 py-0'
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
        <div className="mt-2.5 space-y-2 border-t border-primary/10 pt-2 text-foreground">
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
    <Card className="my-3 overflow-hidden border-border/80 shadow-sm transition-all hover:border-primary/40">
      <CardHeader className="bg-muted/40 p-3.5 sm:p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <CardTitle className="font-mono text-sm sm:text-base font-bold">
              {data.trackingNumber}
            </CardTitle>
          </div>
          <StatusBadge status={data.status as ParcelStatus} />
        </div>
        <CardDescription className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>{data.originCity}</span>
          <ArrowRight className="h-3 w-3" />
          <span>{data.destinationCity}</span>
          <span className="mx-1">•</span>
          <Clock className="h-3 w-3" />
          <span>{formatDateTime(data.lastUpdatedAt)}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3.5 sm:p-4 pt-3">
        {/* Milestone Steps Stepper */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Delivery Milestones
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {data.steps.map((step) => (
              <div
                key={step.status}
                className={`flex flex-col rounded-md border p-2 text-xs transition-colors ${
                  step.current
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : step.completed
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-foreground'
                      : 'border-muted bg-muted/20 text-muted-foreground opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2
                    className={`h-3 w-3 shrink-0 ${
                      step.completed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                  <span className="truncate text-[11px] font-semibold">
                    {step.label}
                  </span>
                </div>
                {step.timestamp && (
                  <span className="mt-1 text-[10px] text-muted-foreground truncate">
                    {formatDateTime(step.timestamp)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 p-3 sm:px-4">
        <div className="text-[11px] text-muted-foreground">
          {data.parcelId
            ? 'Verified customer owner'
            : 'Public tracking summary'}
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
              <span>Open Live Tracker</span>
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
    <Card className="my-3 overflow-hidden border-border/80 shadow-sm transition-all hover:border-primary/40">
      <CardHeader className="bg-primary/5 p-3.5 sm:p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
              LKR
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-bold">
                {data.pickupCity} → {data.deliveryCity}
              </CardTitle>
              <CardDescription className="text-xs">
                {data.weightKg} kg · {data.size} Tier
              </CardDescription>
            </div>
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
              Estimated Delivery Total
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
            <span>Proceed to Book This Parcel</span>
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
    <Card className="my-3 overflow-hidden border-border/80 shadow-sm">
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
    <Card className="my-3 overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="bg-muted/30 p-3.5 pb-2 sm:p-4 sm:pb-3">
        <CardTitle className="text-sm font-semibold">
          SwiftDrop Delivery Service Zones ({data.zones.length})
        </CardTitle>
        <CardDescription className="text-xs">
          Active geographic coverage for standard and express delivery.
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
