import { WorkspacePage } from '~/shared/components/workspace-page';
import { useIdentity } from '~/features/identity/session';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  Package,
  ReceiptText,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { IdentityShell, Protected } from '~/features/identity/components';
import { Alert, AlertDescription } from '~/shared/components/ui/alert';
import { Button } from '~/shared/components/ui/button';
import { Card, CardContent, CardHeader } from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { Skeleton } from '~/shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import { formatDateTime, formatMoney, StatusBadge } from './components';
import type { ParcelStatus } from './contracts';
import { useCustomerParcels, useDownloadReceiptPdf } from './hooks';

type FilterTab = 'All' | 'InTransit' | 'Delivered' | 'Cancelled' | 'Failed';

const FILTER_TABS: readonly { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'All' },
  { label: 'In Transit', value: 'InTransit' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Cancelled', value: 'Cancelled' },
  { label: 'Failed', value: 'Failed' },
];

export function OrderHistoryContent({
  operational = false,
}: {
  operational?: boolean;
}) {
  const { user } = useIdentity();
  const basePath = operational ? '/dispatch' : '/customer';
  const canDownload = !operational || !!user?.roles.includes('Admin');
  const [filter, setFilter] = useState<FilterTab>('All');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const statusParam: ParcelStatus | undefined =
    filter === 'All' ? undefined : filter;

  const { data, isLoading, isError } = useCustomerParcels(
    {
      status: statusParam,
      search: appliedSearch || undefined,
      page,
      pageSize,
    },
    operational,
  );
  const { downloadReceiptPdf, downloadingParcelId, downloadError } =
    useDownloadReceiptPdf();

  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const items = data?.items ?? [];

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  return (
    <WorkspacePage
      title={operational ? 'Parcel tracking & history' : 'Order History'}
      description={
        operational
          ? 'Search all parcels and follow delivery progress across the network.'
          : 'Browse your past and active parcel bookings, track live status, or download receipts.'
      }
    >
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Filter by status"
            >
              {FILTER_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  type="button"
                  size="sm"
                  variant={filter === tab.value ? 'default' : 'outline'}
                  onClick={() => {
                    setFilter(tab.value);
                    setPage(1);
                  }}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tracking # or recipient"
                  className="w-56 pl-8"
                  aria-label="Search orders"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                Search
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {downloadError && (
            <div className="mb-4">
              <Alert variant="destructive">
                <AlertDescription>{downloadError}</AlertDescription>
              </Alert>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Could not load your order history. Please try again shortly.
              </AlertDescription>
            </Alert>
          ) : items.length === 0 ? (
            <Card className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <Package className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                No matching parcels found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try clearing your filters or create a new delivery booking.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking #</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Booked</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((parcel) => (
                      <TableRow key={parcel.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {parcel.trackingNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {parcel.pickupCity} → {parcel.deliveryCity}
                        </TableCell>
                        <TableCell className="text-sm">
                          {parcel.recipientName}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={parcel.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(parcel.createdAt)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatMoney(
                            parcel.priceSnapshot.total,
                            parcel.priceSnapshot.currency,
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`${basePath}/parcels/${parcel.id}`}>
                                <MapPin className="mr-1 size-3.5" />
                                Track
                              </Link>
                            </Button>
                            {canDownload && parcel.status === 'Delivered' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={downloadingParcelId === parcel.id}
                                  onClick={() =>
                                    void downloadReceiptPdf(
                                      parcel.id,
                                      parcel.trackingNumber,
                                    ).catch(() => {})
                                  }
                                >
                                  <Download className="mr-1 size-3.5" />
                                  {downloadingParcelId === parcel.id
                                    ? 'Downloading…'
                                    : 'Download PDF Receipt'}
                                </Button>
                                <Button size="sm" variant="secondary" asChild>
                                  <Link
                                    to={`${basePath}/parcels/${parcel.id}/receipt`}
                                  >
                                    <ReceiptText className="mr-1 size-3.5" />
                                    Receipt
                                  </Link>
                                </Button>
                                <Button size="sm" variant="ghost" asChild>
                                  <Link
                                    to={`${basePath}/parcels/${parcel.id}#pod`}
                                    title="View Proof of Delivery"
                                  >
                                    <ShieldCheck className="size-4 text-emerald-600" />
                                  </Link>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between border-t pt-4 text-sm">
                <p className="text-muted-foreground">
                  Showing page {page} of {totalPages} ({totalCount} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    Next
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}

export function OrderHistoryPage() {
  return (
    <IdentityShell>
      <Protected roles={['Customer']}>
        <OrderHistoryContent />
      </Protected>
    </IdentityShell>
  );
}
