import { Link } from 'react-router';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Phone,
  Truck,
  UserRound,
} from 'lucide-react';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { displayMoney } from '~/shared/exact-json';
import type { Assigned, Detail, Summary } from './api';
export const statusLabel = (status: string) =>
  status.replace(/([a-z])([A-Z])/g, '$1 $2');
export function DeliveryStatus({ status }: { status: Summary['status'] }) {
  const Icon = status === 'Delivered' ? CheckCircle2 : Truck;
  return (
    <Badge
      variant={
        status === 'Failed'
          ? 'destructive'
          : status === 'Delivered'
            ? 'secondary'
            : 'outline'
      }
      className="gap-1.5"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {statusLabel(status)}
    </Badge>
  );
}
export function AssignmentCard({ delivery: d }: { delivery: Assigned }) {
  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden">
      <CardHeader className="space-y-3 p-4 pb-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DeliveryStatus status={d.status} />
          {d.isOverdue && (
            <Badge variant="destructive">
              <Clock3 className="mr-1 size-3" aria-hidden="true" />
              Overdue
            </Badge>
          )}
        </div>
        <CardTitle className="text-base">
          <Link
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            to={`/courier/parcels/${d.id}`}
          >
            {d.trackingNumber}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="grid gap-3 text-sm">
          <div className="flex gap-3">
            <UserRound
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="min-w-0 break-words font-medium">
              {d.recipient.name}
            </span>
          </div>
          <div className="flex gap-3">
            <MapPin
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="break-words">{d.deliveryAddress.street}</p>
              <p className="text-muted-foreground">
                {d.deliveryAddress.city} {d.deliveryAddress.postalCode}
              </p>
            </div>
          </div>
          <div className="flex gap-3 text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            <span>Service date: {d.serviceDate}</span>
          </div>
          <div className="flex gap-3 text-muted-foreground">
            <Package className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {d.packageDetails.size} / {d.packageDetails.weightKg} kg
            </span>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <span className="text-sm font-semibold">
            {displayMoney(d.priceSnapshot.total, d.priceSnapshot.currency)}
          </span>
          <div className="flex gap-2">
            <Button asChild size="icon" variant="outline">
              <a
                href={`tel:${d.recipient.phoneNumber.replace(/[^+0-9]/g, '')}`}
                aria-label={`Call ${d.recipient.name}`}
              >
                <Phone aria-hidden="true" />
              </a>
            </Button>
            <Button asChild size="sm">
              <Link to={`/courier/parcels/${d.id}`}>
                Open delivery
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export function HistoryCard({ delivery: d }: { delivery: Summary }) {
  return (
    <Card className="flex h-full flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Package className="size-5 text-muted-foreground" aria-hidden="true" />
        <DeliveryStatus status={d.status} />
      </div>
      <h2 className="font-semibold">{d.trackingNumber}</h2>
      <dl className="grid gap-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-muted-foreground">Delivery fee</dt>
          <dd className="font-medium">
            {displayMoney(d.priceSnapshot.total, d.priceSnapshot.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Booked</dt>
          <dd>{new Date(d.createdAt).toLocaleString()}</dd>
        </div>
      </dl>
      <p className="mt-auto border-t pt-3 text-xs text-muted-foreground">
        Version {d.version} | Pricing {d.priceSnapshot.pricingVersion}
      </p>
    </Card>
  );
}
export function StatusTimeline({ history }: { history: Detail['history'] }) {
  return (
    <Card className="gap-4 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Status history</h2>
      <ol className="space-y-0">
        {history.map((item, index) => (
          <li key={index} className="flex gap-4">
            <div className="flex shrink-0 flex-col items-center">
              <div className="grid size-8 place-items-center rounded-full border bg-muted">
                <CheckCircle2
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              {index < history.length - 1 && (
                <div className="min-h-8 w-px flex-1 bg-border" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1 pb-6">
              <p className="font-medium">
                {item.fromStatus ? `${statusLabel(item.fromStatus)} to ` : ''}
                {statusLabel(item.toStatus)}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(item.timestamp).toLocaleString()}
              </p>
              {item.changeReason && (
                <p className="text-sm">Reason: {item.changeReason}</p>
              )}
              {item.deliveryNote && (
                <p className="break-words text-sm text-muted-foreground">
                  {item.deliveryNote}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {!history.length && (
        <p className="text-sm text-muted-foreground">
          No status history recorded.
        </p>
      )}
    </Card>
  );
}
