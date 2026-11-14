import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleCheck,
  CircleDot,
  MapPin,
  Package,
  PackageSearch,
  Truck,
  UserRound,
  type LucideIcon,
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
import { Progress } from '~/shared/components/ui/progress';
import { Separator } from '~/shared/components/ui/separator';
import { cn } from '~/shared/lib/utils';
import {
  PARCEL_STATUS_LABELS,
  type CustomerParcelListItem,
  type ParcelStatus,
} from './contracts';
import { formatDateTime, formatMoney, StatusBadge } from './components';
import { detailHref } from './navigation';

/** Customer-only compositions. Shared controls and the other role workspaces stay unchanged. */
export function CustomerSectionHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <CardHeader className="flex flex-col gap-4 space-y-0 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        <Badge
          variant="outline"
          className="size-10 shrink-0 justify-center rounded-xl border-primary/15 bg-primary/5 p-0 text-primary"
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </Badge>
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="text-base">
            <h2>{title}</h2>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
      </div>
      {action}
    </CardHeader>
  );
}

export function CustomerEmptyState({
  title,
  description,
  icon: Icon = PackageSearch,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardContent className="flex flex-col items-center gap-4 px-4 py-10 text-center">
        <Badge
          variant="outline"
          className="size-14 justify-center rounded-2xl border-primary/15 bg-primary/5 p-0 text-primary"
          aria-hidden="true"
        >
          <Icon className="size-7" />
        </Badge>
        <div className="max-w-sm space-y-2">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function DeliveryRoute({
  pickup,
  delivery,
  compact = false,
}: {
  pickup: string;
  delivery: string;
  compact?: boolean;
}) {
  if (compact)
    return (
      <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">
        <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="break-words">{pickup}</span>
        <ArrowRight
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="break-words">{delivery}</span>
      </p>
    );
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm">
      <CircleDot className="mx-auto size-4 text-primary" aria-hidden="true" />
      <div>
        <p className="text-xs text-muted-foreground">From</p>
        <p className="break-words font-medium">{pickup}</p>
      </div>
      <ArrowDown
        className="mx-auto size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      <span />
      <MapPin className="mx-auto size-4 text-primary" aria-hidden="true" />
      <div>
        <p className="text-xs text-muted-foreground">To</p>
        <p className="break-words font-medium">{delivery}</p>
      </div>
    </div>
  );
}

const milestones: { status: ParcelStatus; icon: LucideIcon }[] = [
  { status: 'Created', icon: Package },
  { status: 'Assigned', icon: UserRound },
  { status: 'PickedUp', icon: Package },
  { status: 'InTransit', icon: Truck },
  { status: 'OutForDelivery', icon: MapPin },
  { status: 'Delivered', icon: CircleCheck },
];

export function CustomerJourney({
  status,
  compact = false,
}: {
  status: ParcelStatus;
  compact?: boolean;
}) {
  const index = milestones.findIndex((step) => step.status === status);
  if (index < 0)
    return (
      <div className="space-y-2">
        <StatusBadge status={status} />
        <p className="text-sm text-muted-foreground">
          {status === 'Failed'
            ? 'Check the delivery timeline for the outcome of this attempt.'
            : 'This booking is closed. Its updates remain in the delivery timeline.'}
        </p>
      </div>
    );
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium">{PARCEL_STATUS_LABELS[status]}</span>
          <span className="text-muted-foreground">
            Milestone {index + 1} of {milestones.length}
          </span>
        </div>
        <Progress
          value={(index / (milestones.length - 1)) * 100}
          aria-label="Delivery milestones"
          aria-valuetext={`${PARCEL_STATUS_LABELS[status]}, milestone ${index + 1} of ${milestones.length}`}
          className="h-1.5 bg-primary/10 [&>div]:bg-primary"
        />
      </div>
      {!compact && (
        <ol
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
          aria-label="Delivery journey"
        >
          {milestones.map((step, position) => {
            const Icon = position < index ? Check : step.icon;
            return (
              <li
                key={step.status}
                aria-current={position === index ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-3 xl:flex-col xl:items-start',
                  position === index
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-transparent bg-muted/30',
                )}
              >
                <Badge
                  variant="outline"
                  className={cn(
                    'size-7 shrink-0 justify-center rounded-full p-0',
                    position <= index
                      ? 'border-primary/20 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  <Icon className="size-3.5" />
                </Badge>
                <div>
                  <p className="text-xs font-medium">
                    {PARCEL_STATUS_LABELS[step.status]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {position === index
                      ? 'Current'
                      : position < index
                        ? 'Complete'
                        : 'Upcoming'}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function ActiveDeliveryCards({
  items,
  origin,
}: {
  items: CustomerParcelListItem[];
  origin: string;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id} className="flex min-w-0 flex-col overflow-hidden">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3 space-y-0 bg-muted/20 p-4 sm:flex-row">
            <div className="flex min-w-0 items-center gap-2">
              <Package
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <p className="break-all font-mono text-sm font-semibold">
                {item.trackingNumber}
              </p>
            </div>
            <StatusBadge status={item.status} />
          </CardHeader>
          <CardContent className="flex-1 space-y-4 p-4 sm:p-5">
            <DeliveryRoute
              pickup={item.pickupCity}
              delivery={item.deliveryCity}
            />
            <Separator />
            <p className="flex items-center gap-2 text-sm">
              <UserRound
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0 break-words">
                To {item.recipientName}
              </span>
            </p>
            <CustomerJourney compact status={item.status} />
            <p className="text-xs text-muted-foreground">
              Updated {formatDateTime(item.updatedAt)}
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
            <div>
              <p className="text-sm font-semibold">
                {formatMoney(
                  item.priceSnapshot.total,
                  item.priceSnapshot.currency,
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.packageDetails.size} · {item.packageDetails.weightKg} kg
              </p>
            </div>
            <Button size="sm" asChild>
              <Link to={detailHref(item.id)} state={{ returnTo: origin }}>
                View details
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
