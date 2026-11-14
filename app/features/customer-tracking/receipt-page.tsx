import { WorkspacePage } from '~/shared/components/workspace-page';
import { Link, Navigate, useLocation, useParams } from 'react-router';
import { ArrowLeft, Download } from 'lucide-react';
import { IdentityShell, Protected } from '~/features/identity/components';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';
import { Button } from '~/shared/components/ui/button';
import { Skeleton } from '~/shared/components/ui/skeleton';
import { ReceiptCard } from './components';
import { useDownloadReceiptPdf, useParcelReceipt } from './hooks';

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
  const { downloadReceiptPdf, downloadingParcelId, downloadError } =
    useDownloadReceiptPdf();

  return (
    <WorkspacePage
      title="Delivery receipt"
      description="View and download the receipt for your completed delivery."
    >
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link
            to={`${operational ? '/dispatch' : '/customer'}/parcels/${parcelId}`}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            Back to Parcel Tracking
          </Link>
        </Button>
        {receipt && (
          <Button
            size="sm"
            disabled={downloadingParcelId === parcelId}
            onClick={() =>
              void downloadReceiptPdf(
                receipt.parcelId,
                receipt.trackingNumber,
              ).catch(() => {})
            }
          >
            <Download className="mr-1.5 size-4" />
            {downloadingParcelId === parcelId
              ? 'Downloading…'
              : 'Download PDF Receipt'}
          </Button>
        )}
      </div>

      {downloadError && (
        <Alert variant="destructive">
          <AlertDescription>{downloadError}</AlertDescription>
        </Alert>
      )}

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
  const location = useLocation();
  return (
    <IdentityShell>
      <Protected roles={['Customer']}>
        {
          <Navigate
            replace
            to={
              id
                ? `/customer/parcels/${encodeURIComponent(id)}?tab=documents`
                : '/customer/history?status=Delivered'
            }
            state={location.state as unknown}
          />
        }
      </Protected>
    </IdentityShell>
  );
}
