import { deliveryFailureLabel } from '~/shared/delivery-failure';
import { CustomerDeliveryDetail, CustomerTrackingHub } from './customer-pages';
import { type ReactNode } from 'react';
import type { ParcelDetail } from './contracts';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Package,
  Radio,
  ReceiptText,
} from 'lucide-react';
import { IdentityShell, Protected } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Skeleton } from '~/shared/components/ui/skeleton';
import {
  DeliveryStepper,
  ProofOfDeliveryCard,
  StatusBadge,
  formatDateTime,
  formatMoney,
} from './components';
import { PARCEL_STATUS_LABELS } from './contracts';
import {
  useCustomerParcel,
  useLiveParcelTracking,
  useParcelProof,
} from './hooks';

export function ParcelLiveDetail({
  parcelId,
  operational = false,
  renderActions,
}: {
  parcelId: string;
  operational?: boolean;
  renderActions?: (parcel: ParcelDetail) => ReactNode;
}) {
  const { user } = useIdentity();
  const canDownload = !operational || !!user?.roles.includes('Admin');
  const {
    data: parcel,
    isLoading,
    isError,
  } = useCustomerParcel(parcelId, operational);
  const isTerminal =
    parcel?.status === 'Delivered' ||
    parcel?.status === 'Failed' ||
    parcel?.status === 'Cancelled';
  const { connectionState } = useLiveParcelTracking(
    parcelId,
    Boolean(parcel) && !isTerminal,
  );
  const { data: proof } = useParcelProof(
    parcelId,
    parcel?.status === 'Delivered',
    operational,
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !parcel) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Parcel not found</AlertTitle>
        <AlertDescription>
          This parcel could not be loaded or you do not have permission to view
          it.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link to={operational ? '/dispatch/parcels' : '/customer/history'}>
              <ArrowLeft className="mr-1.5 size-4" />
              {operational
                ? 'Back to parcel history'
                : 'Back to Delivery history'}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-2xl font-bold tracking-tight">
              {parcel.trackingNumber}
            </h1>
            <StatusBadge status={parcel.status} />
            {!isTerminal && (
              <Badge variant="outline" className="gap-1.5">
                <Radio
                  className={`size-3.5 ${
                    connectionState === 'live'
                      ? 'animate-pulse text-emerald-600'
                      : 'text-amber-500'
                  }`}
                />
                {connectionState === 'live'
                  ? 'Live SSE'
                  : connectionState === 'polling'
                    ? 'Auto-refreshing'
                    : 'Connecting…'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Booked {formatDateTime(parcel.createdAt)} · Version {parcel.version}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {renderActions?.(parcel)}
          {parcel.status === 'Delivered' && canDownload && (
            <Button asChild>
              <Link
                to={`${operational ? '/dispatch' : '/customer'}/parcels/${parcel.id}/receipt`}
              >
                <ReceiptText className="mr-2 size-4" />
                View & Download Receipt
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <DeliveryStepper status={parcel.status} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              Pickup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{parcel.pickupAddress.street}</p>
            <p className="text-muted-foreground">
              {parcel.pickupAddress.city}, {parcel.pickupAddress.postalCode}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              Drop-off & Recipient
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{parcel.recipient.name}</p>
            <p className="text-muted-foreground">
              {parcel.recipient.phoneNumber}
            </p>
            <p className="text-muted-foreground">
              {parcel.deliveryAddress.street}, {parcel.deliveryAddress.city}{' '}
              {parcel.deliveryAddress.postalCode}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Package className="size-4" />
              Parcel & Fee
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">
              {parcel.packageDetails.size} · {parcel.packageDetails.weightKg} kg
            </p>
            <p className="text-base font-semibold">
              {formatMoney(
                parcel.priceSnapshot.total,
                parcel.priceSnapshot.currency,
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Pricing {parcel.priceSnapshot.pricingVersion}
            </p>
          </CardContent>
        </Card>
      </div>

      {parcel.status === 'Delivered' && proof && (
        <div id="pod">
          <ProofOfDeliveryCard parcelId={parcel.id} proof={proof} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4" />
            Status Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 border-l pl-4">
            {parcel.history.map((entry, idx) => (
              <li key={`${entry.timestamp}-${idx}`} className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">
                    {PARCEL_STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(entry.timestamp)}
                  </span>
                </div>
                {entry.changeReason && (
                  <p className="text-xs text-muted-foreground">
                    Reason: {deliveryFailureLabel(entry.changeReason)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

export function CustomerTrackingPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <IdentityShell>
      <Protected roles={['Customer']}>
        {id ? (
          <CustomerDeliveryDetail parcelId={id} />
        ) : (
          <CustomerTrackingHub />
        )}
      </Protected>
    </IdentityShell>
  );
}
