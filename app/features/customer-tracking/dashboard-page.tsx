import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  History,
  MapPin,
  PackageCheck,
  PackagePlus,
  ReceiptText,
  Search,
  Truck,
} from 'lucide-react';
import { IdentityShell, Protected } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
import { Alert, AlertDescription } from '~/shared/components/ui/alert';
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
import { formatDateTime, formatMoney, StatusBadge } from './components';
import { useCustomerParcels } from './hooks';

function CustomerDashboardContent() {
  const { session } = useIdentity();
  const user = session.getSnapshot().user;
  const navigate = useNavigate();
  const [trackingQuery, setTrackingQuery] = useState('');
  const { data, isLoading, isError } = useCustomerParcels({
    page: 1,
    pageSize: 5,
  });

  const items = data?.items ?? [];
  const activeCount = items.filter(
    (item) =>
      item.status !== 'Delivered' &&
      item.status !== 'Failed' &&
      item.status !== 'Cancelled',
  ).length;
  const deliveredCount = items.filter(
    (item) => item.status === 'Delivered',
  ).length;

  const handleTrackSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = trackingQuery.trim();
    if (!trimmed) return;
    void navigate(`/track?code=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back
            {user?.fullName ? `, ${user.fullName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Track live deliveries, review past orders, and download official
            receipts.
          </p>
        </div>
        <Button asChild>
          <Link to="/customer/book">
            <PackagePlus className="mr-2 size-4" />
            Book a Delivery
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Parcel Lookup</CardTitle>
          <CardDescription>
            Enter any SwiftDrop tracking number to check its live delivery
            progress.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleTrackSubmit}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={trackingQuery}
                onChange={(e) => setTrackingQuery(e.target.value)}
                placeholder="e.g. TRK-..."
                aria-label="Tracking number"
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary">
              Track Parcel
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bookings
            </CardTitle>
            <Truck className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Active
            </CardTitle>
            <MapPin className="size-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Delivered
            </CardTitle>
            <PackageCheck className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveredCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Recent Deliveries</CardTitle>
            <CardDescription>
              Your latest bookings and their current status.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/customer/history">
              View All
              <ArrowRight className="ml-1.5 size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Unable to load your recent deliveries right now.
              </AlertDescription>
            </Alert>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
              <History className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No deliveries yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Book your first parcel to track it live from pickup to drop-off.
              </p>
              <Button className="mt-4" size="sm" asChild>
                <Link to="/customer/book">Book a Delivery</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((parcel) => (
                <div
                  key={parcel.id}
                  className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {parcel.trackingNumber}
                      </span>
                      <StatusBadge status={parcel.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {parcel.pickupCity} → {parcel.deliveryCity} · To{' '}
                      {parcel.recipientName} ·{' '}
                      {formatDateTime(parcel.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatMoney(
                        parcel.priceSnapshot.total,
                        parcel.priceSnapshot.currency,
                      )}
                    </span>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/customer/parcels/${parcel.id}`}>
                        <MapPin className="mr-1.5 size-3.5" />
                        Track
                      </Link>
                    </Button>
                    {parcel.status === 'Delivered' && (
                      <Button size="sm" variant="secondary" asChild>
                        <Link to={`/customer/parcels/${parcel.id}/receipt`}>
                          <ReceiptText className="mr-1.5 size-3.5" />
                          Receipt
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CustomerDashboardWorkspace() {
  return (
    <IdentityShell>
      <Protected>
        <CustomerDashboardContent />
      </Protected>
    </IdentityShell>
  );
}
