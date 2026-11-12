import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  Package,
  Printer,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { useIdentity } from '~/features/identity/session';
import { Alert, AlertDescription, AlertTitle } from '~/shared/components/ui/alert';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Separator } from '~/shared/components/ui/separator';
import { Skeleton } from '~/shared/components/ui/skeleton';
import { downloadReceiptPdf, fetchParcelProofImageUrl } from './api';
import {
  PARCEL_STATUS_LABELS,
  type ParcelReceipt,
  type ParcelStatus,
  type ProofOfDeliveryInfo,
} from './contracts';

const STEP_ORDER: readonly ParcelStatus[] = [
  'Created',
  'Assigned',
  'PickedUp',
  'InTransit',
  'OutForDelivery',
  'Delivered',
];

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatMoney(amount: number, currency = 'LKR'): string {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function StatusBadge({ status }: { status: ParcelStatus }) {
  const variantClass =
    status === 'Delivered'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
      : status === 'Failed' || status === 'Cancelled'
        ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300'
        : status === 'OutForDelivery' || status === 'InTransit'
          ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300'
          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300';

  return (
    <Badge variant="outline" className={variantClass}>
      {PARCEL_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function DeliveryStepper({ status }: { status: ParcelStatus }) {
  if (status === 'Failed' || status === 'Cancelled') {
    return (
      <Alert variant="destructive">
        {status === 'Failed' ? (
          <AlertTriangle className="size-4" />
        ) : (
          <XCircle className="size-4" />
        )}
        <AlertTitle>{PARCEL_STATUS_LABELS[status]}</AlertTitle>
        <AlertDescription>
          {status === 'Failed'
            ? 'This delivery attempt could not be completed. Check the timeline below for details.'
            : 'This parcel booking was cancelled before pickup.'}
        </AlertDescription>
      </Alert>
    );
  }

  const activeIndex = STEP_ORDER.indexOf(status);

  return (
    <div className="grid gap-3 sm:grid-cols-6" aria-label="Delivery progress">
      {STEP_ORDER.map((step, index) => {
        const completed = index <= activeIndex;
        const current = index === activeIndex;
        return (
          <div
            key={step}
            className={`flex items-center gap-2.5 rounded-lg border p-3 transition-colors sm:flex-col sm:items-start ${
              current
                ? 'border-primary bg-primary/5'
                : completed
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                  : 'border-border bg-muted/30 opacity-65'
            }`}
          >
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                completed
                  ? 'bg-emerald-600 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {completed ? <CheckCircle2 className="size-4" /> : index + 1}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {PARCEL_STATUS_LABELS[step]}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {current ? 'Current' : completed ? 'Done' : 'Pending'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProofOfDeliveryCard({
  parcelId,
  proof,
}: {
  parcelId: string;
  proof: ProofOfDeliveryInfo;
}) {
  const { session } = useIdentity();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let createdUrl: string | null = null;

    fetchParcelProofImageUrl(
      session.authenticatedRequest,
      session.api.base,
      parcelId,
      controller.signal,
    )
      .then((url) => {
        createdUrl = url;
        setImageUrl(url);
      })
      .catch(() => {
        if (!controller.signal.aborted) setImageError(true);
      });

    return () => {
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [parcelId, session]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-emerald-600" />
              Proof of Delivery
            </CardTitle>
            <CardDescription>
              Confirmed receipt by {proof.recipientName} on{' '}
              {formatDateTime(proof.uploadedAt)}
            </CardDescription>
          </div>
          <Badge variant="secondary">{proof.proofType}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {imageError ? (
          <p className="text-sm text-muted-foreground">
            Proof image preview is currently unavailable.
          </p>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={`Proof of delivery for ${proof.trackingNumber}`}
            className="max-h-72 w-full rounded-lg border object-contain bg-muted/20"
          />
        ) : (
          <Skeleton className="h-48 w-full rounded-lg" />
        )}
      </CardContent>
    </Card>
  );
}

export function ReceiptCard({ receipt }: { receipt: ParcelReceipt }) {
  const { session } = useIdentity();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadReceiptPdf(
        session.authenticatedRequest,
        session.api.base,
        receipt.parcelId,
        receipt.trackingNumber,
      );
    } catch {
      setDownloadError('Unable to download PDF receipt right now. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="print:border-0 print:shadow-none">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            <span className="text-lg font-bold tracking-tight">SwiftDrop</span>
          </div>
          <CardTitle className="mt-2 text-xl">
            Receipt {receipt.receiptNumber}
          </CardTitle>
          <CardDescription>
            Tracking #{receipt.trackingNumber} · Pricing {receipt.pricingVersion}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            type="button"
          >
            <Printer className="mr-1.5 size-4" />
            Print
          </Button>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            type="button"
          >
            <Download className="mr-1.5 size-4" />
            {downloading ? 'Downloading…' : 'Download PDF'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {downloadError && (
          <Alert variant="destructive">
            <AlertDescription>{downloadError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Booked</p>
            <p className="mt-0.5 text-sm font-medium">
              {formatDateTime(receipt.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Delivered</p>
            <p className="mt-0.5 text-sm font-medium">
              {formatDateTime(receipt.deliveredAt)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Parcel</p>
            <p className="mt-0.5 text-sm font-medium">
              {receipt.packageDetails.size} · {receipt.packageDetails.weightKg} kg
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="size-3.5" />
              Pickup Address
            </p>
            <p className="text-sm font-medium">{receipt.pickupAddress.street}</p>
            <p className="text-sm text-muted-foreground">
              {receipt.pickupAddress.city}, {receipt.pickupAddress.postalCode}
            </p>
          </div>

          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Package className="size-3.5" />
              Delivery & Recipient
            </p>
            <p className="text-sm font-medium">{receipt.recipient.name}</p>
            <p className="text-sm text-muted-foreground">
              {receipt.recipient.phoneNumber}
            </p>
            <p className="text-sm text-muted-foreground">
              {receipt.deliveryAddress.street}, {receipt.deliveryAddress.city}{' '}
              {receipt.deliveryAddress.postalCode}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Itemized Fee Breakdown
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Base Delivery Fee</span>
            <span>{formatMoney(receipt.baseFee, receipt.currency)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Weight Surcharge</span>
            <span>{formatMoney(receipt.weightFee, receipt.currency)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total Charged</span>
            <span>{formatMoney(receipt.total, receipt.currency)}</span>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            Price snapshot calculated {formatDateTime(receipt.calculatedAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

