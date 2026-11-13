import { WorkspacePage } from '~/shared/components/workspace-page';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Package,
  Radio,
  ReceiptText,
  Search,
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
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
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
  useCustomerParcels,
  useLiveParcelTracking,
  useParcelProof,
} from './hooks';

function TrackingHub() {
  const navigate = useNavigate();
  const [trackingCode, setTrackingCode] = useState('');
  const { data, isLoading } = useCustomerParcels({ page: 1, pageSize: 6 });

  const handleLookup = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = trackingCode.trim();
    if (!trimmed) return;
    void navigate(`/track?code=${encodeURIComponent(trimmed)}`);
  };

  return (
    <WorkspacePage
      title={<>Track a Parcel</>}
      description="Select one of your active bookings below or look up any tracking number."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Track by Tracking Number</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleLookup}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="Enter tracking number (e.g. TRK-...)"
                className="pl-9"
              />
            </div>
            <Button type="submit">Track</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Recent Parcels</CardTitle>
          <CardDescription>
            Click any parcel to open its live SSE tracking timeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !data?.items.length ? (
            <p className="text-sm text-muted-foreground">
              You have no bookings yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.items.map((item) => (
                <Card
                  key={item.id}
                  className="transition-colors hover:bg-muted/40"
                >
                  <Link
                    to={`/customer/parcels/${item.id}`}
                    className="flex items-center justify-between gap-3 p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-mono text-sm font-semibold">
                        {item.trackingNumber}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.pickupCity} → {item.deliveryCity} ·{' '}
                        {item.recipientName}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}

export function ParcelLiveDetail({
  parcelId,
  operational = false,
}: {
  parcelId: string;
  operational?: boolean;
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
              {operational ? 'Back to parcel history' : 'Back to Order History'}
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
                    Reason: {entry.changeReason}
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
        {id ? <ParcelLiveDetail parcelId={id} /> : <TrackingHub />}
      </Protected>
    </IdentityShell>
  );
}
