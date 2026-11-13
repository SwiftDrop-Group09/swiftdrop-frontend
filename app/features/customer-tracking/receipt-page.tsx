import { WorkspacePage } from '~/shared/components/workspace-page';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import { IdentityShell, Protected } from '~/features/identity/components';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Skeleton } from '~/shared/components/ui/skeleton';
import {
  ReceiptCard,
  StatusBadge,
  formatDateTime,
  formatMoney,
} from './components';
import { useCustomerParcels, useParcelReceipt } from './hooks';

function DeliveredReceiptsList() {
  const { data, isLoading, isError } = useCustomerParcels({
    status: 'Delivered',
    page: 1,
    pageSize: 20,
  });

  return (
    <WorkspacePage
      title={<>Delivery Receipts</>}
      description="Official itemized receipts are available for all completed deliveries."
    >
      <Card>
        <CardHeader>
          <CardTitle>Completed Deliveries</CardTitle>
          <CardDescription>
            Select a delivered parcel to view, print, or download its PDF
            receipt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Unable to load delivered parcels right now.
              </AlertDescription>
            </Alert>
          ) : !data?.items.length ? (
            <Card className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
              <ReceiptText className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                No receipts available yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Receipts become available once a parcel is marked Delivered.
              </p>
            </Card>
          ) : (
            <div className="divide-y">
              {data.items.map((parcel) => (
                <div
                  key={parcel.id}
                  className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {parcel.trackingNumber}
                      </span>
                      <StatusBadge status={parcel.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {parcel.pickupCity} → {parcel.deliveryCity} ·{' '}
                      {formatDateTime(parcel.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">
                      {formatMoney(
                        parcel.priceSnapshot.total,
                        parcel.priceSnapshot.currency,
                      )}
                    </span>
                    <Button size="sm" asChild>
                      <Link to={`/customer/parcels/${parcel.id}/receipt`}>
                        <ReceiptText className="mr-1.5 size-3.5" />
                        Open Receipt
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}

export function ParcelReceiptDetail({
  parcelId,
  operational = false,
}: {
  parcelId: string;
  operational?: boolean;
}) {
  const {
    data: receipt,
    isLoading,
    error,
  } = useParcelReceipt(parcelId, operational);

  return (
    <WorkspacePage
      title="Delivery receipt"
      description="View and download the receipt for your completed delivery."
    >
      <Button variant="ghost" size="sm" className="-ml-2 print:hidden" asChild>
        <Link
          to={`${operational ? '/dispatch' : '/customer'}/parcels/${parcelId}`}
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Back to Parcel Tracking
        </Link>
      </Button>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : error || !receipt ? (
        <Alert variant="destructive">
          <AlertTitle>Receipt unavailable</AlertTitle>
          <AlertDescription>
            Official receipts are only available for delivered parcels belonging
            to your account.
          </AlertDescription>
        </Alert>
      ) : (
        <ReceiptCard receipt={receipt} />
      )}
    </WorkspacePage>
  );
}

export function CustomerReceiptPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <IdentityShell>
      <Protected roles={['Customer']}>
        {id ? <ParcelReceiptDetail parcelId={id} /> : <DeliveredReceiptsList />}
      </Protected>
    </IdentityShell>
  );
}
