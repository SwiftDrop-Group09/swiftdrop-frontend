import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  MapPin,
  Package,
  Receipt,
  ShieldCheck,
  Terminal,
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
