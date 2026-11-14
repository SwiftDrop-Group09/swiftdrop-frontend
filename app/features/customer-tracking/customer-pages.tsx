import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  PackagePlus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useIdentity } from '~/features/identity/session';
import { WorkspacePage } from '~/shared/components/workspace-page';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '~/shared/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '~/shared/components/ui/tabs';
import { CustomerTrackingApiError, listCustomerParcels } from './api';
import {
  DeliveryStepper,
  ProofOfDeliveryCard,
  ReceiptCard,
  StatusBadge,
  formatDateTime,
  formatMoney,
} from './components';
import {
  PARCEL_STATUSES,
  PARCEL_STATUS_LABELS,
  type CustomerParcelListItem,
  type ParcelDetail,
  type ParcelStatus,
} from './contracts';
import {
  useCustomerParcel,
  useCustomerParcels,
  useCustomerSummary,
  useLiveParcelTracking,
  useParcelProof,
  useParcelReceipt,
} from './hooks';
import { deliveryReturnTo, detailHref, isTerminal } from './navigation';

function Refresh({
  refresh,
  pending,
  disabled = false,
}: {
  refresh: () => void;
  pending: boolean;
  disabled?: boolean;
}) {
  return (
    <Button variant="outline" onClick={refresh} disabled={pending || disabled}>
      <RefreshCw className={pending ? 'size-4 animate-spin' : 'size-4'} />
      Refresh
    </Button>
  );
}

export function DeliveryRows({
  items,
  origin,
}: {
  items: CustomerParcelListItem[];
  origin: string;
}) {
  function actions(item: CustomerParcelListItem) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={detailHref(item.id)} state={{ returnTo: origin }}>
            View details
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        {item.status === 'Delivered' && (
          <Button variant="ghost" size="sm" asChild>
            <Link
              to={detailHref(item.id, 'documents')}
              state={{ returnTo: origin }}
            >
              <FileText className="size-4" />
              Documents
            </Link>
          </Button>
        )}
      </div>
    );
  }
  return (
    <>
      <div className="grid gap-4 md:hidden">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-all font-mono text-sm font-semibold">
                  {item.trackingNumber}
                </p>
                <StatusBadge status={item.status} />
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  {item.pickupCity} → {item.deliveryCity}
                </p>
                <p className="text-muted-foreground">To {item.recipientName}</p>
                <p className="text-xs text-muted-foreground">
                  Booked {formatDateTime(item.createdAt)}
                </p>
              </div>
              <p className="text-sm font-medium">
                {formatMoney(
                  item.priceSnapshot.total,
                  item.priceSnapshot.currency,
                )}
              </p>
              {actions(item)}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Delivery</TableHead>
              <TableHead>Route & recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Booked</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs font-semibold">
                  {item.trackingNumber}
                </TableCell>
                <TableCell>
                  <p>
                    {item.pickupCity} → {item.deliveryCity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.recipientName}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="text-xs">
                  {formatDateTime(item.createdAt)}
                </TableCell>
                <TableCell>
                  {formatMoney(
                    item.priceSnapshot.total,
                    item.priceSnapshot.currency,
                  )}
                </TableCell>
                <TableCell>{actions(item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export function OwnerTrackingLookup({ origin }: { origin: string }) {
  const { session, user } = useIdentity();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const lookup = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => lookup.current?.abort();
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Find a delivery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!code.trim() || pending) return;
            const owner = user?.id;
            const controller = new AbortController();
            lookup.current?.abort();
            lookup.current = controller;
            setPending(true);
            setMessage('');
            void listCustomerParcels(
              session.authenticatedRequest,
              session.api.base,
              { search: code.trim(), pageSize: 100 },
              controller.signal,
            )
              .then((page) => {
                if (
                  controller.signal.aborted ||
                  session.getSnapshot().user?.id !== owner
                )
                  return;
                const match = page.items.find(
                  (item) =>
                    item.trackingNumber.toLowerCase() ===
                    code.trim().toLowerCase(),
                );
                if (match)
                  void navigate(detailHref(match.id, 'tracking'), {
                    state: { returnTo: origin },
                  });
                else
                  setMessage(
                    'No delivery with that tracking number was found in your account. You can also search Delivery history by recipient.',
                  );
              })
              .catch(() => {
                if (
                  !controller.signal.aborted &&
                  session.getSnapshot().user?.id === owner
                )
                  setMessage(
                    'Unable to look up this delivery. Check your connection and try again.',
                  );
              })
              .finally(() => {
                if (!controller.signal.aborted) setPending(false);
              });
          }}
        >
          <Label className="sr-only" htmlFor="owner-tracking">
            Tracking number
          </Label>
          <Input
            id="owner-tracking"
            value={code}
            maxLength={128}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter your tracking number"
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={pending || !code.trim()}>
            <Search className="size-4" />
            {pending ? 'Searching…' : 'Find delivery'}
          </Button>
        </form>
        {message && (
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function CustomerDashboardContent() {
  const { user } = useIdentity();
  const summary = useCustomerSummary();
  return (
    <WorkspacePage
      title={`Welcome back${user?.fullName ? `, ${user.fullName}` : ''}`}
      actions={
        <>
          <Refresh
            refresh={() => void summary.refetch()}
            pending={summary.isFetching}
          />
          <Button asChild>
            <Link to="/customer/book">
              <PackagePlus className="size-4" />
              Book a delivery
            </Link>
          </Button>
        </>
      }
    >
      {summary.isPending ? (
        <WorkspaceLoading label="Loading delivery dashboard" />
      ) : summary.isError || !summary.data ? (
        <WorkspaceNotice
          title="Unable to load your deliveries"
          description="Your delivery totals could not be verified."
          destructive
          retry={() => void summary.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Total deliveries', summary.data.totalCount],
              ['Active deliveries', summary.data.activeCount],
              ['Delivered', summary.data.deliveredCount],
              [
                'Unsuccessful / cancelled',
                summary.data.failedCount + summary.data.cancelledCount,
              ],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tabular-nums">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    All your deliveries
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Active deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.data.activeDeliveries.length ? (
                <DeliveryRows
                  items={summary.data.activeDeliveries}
                  origin="/dashboard"
                />
              ) : (
                <WorkspaceNotice
                  title="No active deliveries"
                  description="Your current deliveries will appear here after booking."
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3 sm:flex-row">
              <CardTitle>Recent history</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/customer/history">
                  Delivery history
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {summary.data.recentDeliveries.length ? (
                <DeliveryRows
                  items={summary.data.recentDeliveries}
                  origin="/dashboard"
                />
              ) : (
                <WorkspaceNotice
                  title="No completed deliveries yet"
                  description="Delivered, cancelled and unsuccessful deliveries appear here."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
      <OwnerTrackingLookup origin="/dashboard" />
    </WorkspacePage>
  );
}

function dateBoundary(value: string, nextDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  )
    return undefined;
  if (nextDay) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function CustomerHistoryContent() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const appliedSearch = params.get('search') ?? '';
  const [draftSearch, setDraftSearch] = useState({
    source: appliedSearch,
    value: appliedSearch,
  });
  const search =
    draftSearch.source === appliedSearch ? draftSearch.value : appliedSearch;
  function setSearch(value: string) {
    setDraftSearch({ source: appliedSearch, value });
  }
  const status = PARCEL_STATUSES.includes(params.get('status') as ParcelStatus)
    ? (params.get('status') as ParcelStatus)
    : undefined;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const invalidDates = Boolean(
    (from && !dateBoundary(from)) ||
    (to && !dateBoundary(to)) ||
    (from && to && from > to),
  );
  const rawPage = Number(params.get('page') ?? 1);
  const page =
    Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000
      ? rawPage
      : 1;
  const query = useCustomerParcels(
    {
      search: appliedSearch.slice(0, 128) || undefined,
      status,
      from: invalidDates ? undefined : dateBoundary(from),
      to: invalidDates ? undefined : dateBoundary(to, true),
      page,
      pageSize: 10,
    },
    false,
    !invalidDates,
  );
  function update(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('page');
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }
  const totalPages = Math.max(1, Math.ceil((query.data?.totalCount ?? 0) / 10));
  return (
    <WorkspacePage
      title="Delivery history"
      actions={
        <>
          <Refresh
            refresh={() => void query.refetch()}
            pending={query.isFetching}
            disabled={invalidDates}
          />
          <Button asChild>
            <Link to="/customer/book">
              <PackagePlus className="size-4" />
              Book a delivery
            </Link>
          </Button>
        </>
      }
    >
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              update('search', search.trim());
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Label className="sr-only" htmlFor="delivery-search">
              Search deliveries
            </Label>
            <Input
              id="delivery-search"
              className="min-w-0 flex-1"
              placeholder="Tracking number or recipient"
              value={search}
              maxLength={128}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button type="submit" variant="secondary">
              <Search className="size-4" />
              Search
            </Button>
          </form>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="history-status">Status</Label>
              <NativeSelect
                id="history-status"
                value={status ?? ''}
                onChange={(event) => update('status', event.target.value)}
              >
                <NativeSelectOption value="">All statuses</NativeSelectOption>
                {PARCEL_STATUSES.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {PARCEL_STATUS_LABELS[value]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-from">Booked from</Label>
              <Input
                id="history-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => update('from', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-to">Booked through</Label>
              <Input
                id="history-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => update('to', event.target.value)}
              />
            </div>
          </div>
          {params.size > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setParams({})}>
              Clear all filters
            </Button>
          )}
        </CardContent>
      </Card>
      {invalidDates ? (
        <WorkspaceNotice
          title="Check the booking dates"
          description="Use a valid start date on or before the end date."
        />
      ) : query.isPending ? (
        <WorkspaceLoading label="Loading delivery history" />
      ) : query.isError || !query.data ? (
        <WorkspaceNotice
          title="Unable to load delivery history"
          description="Your deliveries could not be loaded. Please try again."
          destructive
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-4 sm:p-6">
              {query.data.items.length ? (
                <DeliveryRows
                  items={query.data.items}
                  origin={location.pathname + location.search}
                />
              ) : (
                <WorkspaceNotice
                  title="No matching deliveries"
                  description="Try changing the search, status or booking dates."
                />
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              {query.data.totalCount} deliveries · Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || query.isFetching}
                onClick={() => update('page', String(page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || query.isFetching}
                onClick={() => update('page', String(page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
          {page > totalPages && (
            <Button variant="outline" onClick={() => update('page', '1')}>
              Return to first page
            </Button>
          )}
        </>
      )}
    </WorkspacePage>
  );
}

function DeliveryDocuments({ parcel }: { parcel: ParcelDetail }) {
  const delivered = parcel.status === 'Delivered';
  const receipt = useParcelReceipt(delivered ? parcel.id : undefined);
  const proof = useParcelProof(parcel.id, delivered);
  if (!delivered)
    return (
      <WorkspaceNotice
        title="Documents available after delivery"
        description="Your receipt and any proof of delivery will appear here once this parcel is delivered."
      />
    );
  return (
    <div className="space-y-6">
      {receipt.isPending ? (
        <WorkspaceLoading label="Loading receipt" />
      ) : receipt.isError || !receipt.data ? (
        <WorkspaceNotice
          title="Receipt unavailable"
          description="We could not load this delivery receipt."
          retry={() => void receipt.refetch()}
        />
      ) : (
        <ReceiptCard receipt={receipt.data} />
      )}
      {proof.isPending ? (
        <WorkspaceLoading label="Loading proof of delivery" />
      ) : proof.data ? (
        <ProofOfDeliveryCard parcelId={parcel.id} proof={proof.data} />
      ) : (
        <WorkspaceNotice
          title={
            proof.error instanceof CustomerTrackingApiError &&
            proof.error.status === 404
              ? 'No proof attached'
              : 'Proof of delivery unavailable'
          }
          description="Your delivery status remains visible in the Tracking tab."
          retry={() => void proof.refetch()}
        />
      )}
    </div>
  );
}

export function CustomerDeliveryDetail({ parcelId }: { parcelId: string }) {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const state = location.state as { returnTo?: unknown } | null;
  const back = deliveryReturnTo(state?.returnTo);
  const parcel = useCustomerParcel(parcelId, false, false);
  const { connectionState } = useLiveParcelTracking(
    parcelId,
    !!parcel.data && !isTerminal(parcel.data.status),
  );
  const selected = params.get('tab');
  const tab =
    selected === 'tracking' || selected === 'documents'
      ? selected
      : location.hash === '#pod'
        ? 'documents'
        : 'overview';
  const data = parcel.data;
  return (
    <WorkspacePage
      title="Delivery details"
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to={back}>
              <ArrowLeft className="size-4" />
              {back.startsWith('/dashboard')
                ? 'Back to dashboard'
                : back.startsWith('/customer/tracking')
                  ? 'Back to tracking'
                  : 'Back to Delivery history'}
            </Link>
          </Button>
          <Refresh
            refresh={() => void parcel.refetch()}
            pending={parcel.isFetching}
          />
        </>
      }
    >
      {parcel.isPending ? (
        <WorkspaceLoading label="Loading delivery details" />
      ) : parcel.isError || !data ? (
        <WorkspaceNotice
          title="Unable to load delivery details"
          description="This delivery may be unavailable or belong to another account. Check the link or try again."
          destructive
          retry={() => void parcel.refetch()}
        />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
              <div className="space-y-2">
                <p className="break-all font-mono font-semibold">
                  {data.trackingNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  Booked {formatDateTime(data.createdAt)}
                </p>
              </div>
              <StatusBadge status={data.status} />
              <p className="font-semibold">
                {formatMoney(
                  data.priceSnapshot.total,
                  data.priceSnapshot.currency,
                )}
              </p>
            </CardContent>
          </Card>
          <Tabs
            value={tab}
            onValueChange={(value) => {
              const next = new URLSearchParams(params);
              next.set('tab', value);
              setParams(next, {
                replace: true,
                state: location.state as unknown,
              });
            }}
          >
            <TabsList className="grid w-full grid-cols-3 sm:w-fit">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <div className="grid gap-6 lg:grid-cols-2">
                {[
                  [
                    'Pickup',
                    data.pickupAddress.street,
                    `${data.pickupAddress.city}, ${data.pickupAddress.postalCode}`,
                  ],
                  [
                    'Delivery & recipient',
                    data.recipient.name,
                    data.recipient.phoneNumber,
                    data.deliveryAddress.street,
                    `${data.deliveryAddress.city}, ${data.deliveryAddress.postalCode}`,
                  ],
                  [
                    'Parcel',
                    `${data.packageDetails.size} · ${data.packageDetails.weightKg} kg`,
                    `Confirmed price: ${formatMoney(data.priceSnapshot.total, data.priceSnapshot.currency)}`,
                  ],
                ].map(([title, ...lines]) => (
                  <Card key={title}>
                    <CardHeader>
                      <CardTitle>{title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {lines.map((line, index) => (
                        <p className="break-words" key={index}>
                          {line}
                        </p>
                      ))}
                    </CardContent>
                  </Card>
                ))}
                <Card>
                  <CardHeader>
                    <CardTitle>Delivery progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm">
                      {PARCEL_STATUS_LABELS[data.status]}
                    </p>
                    {data.assignment && (
                      <p className="text-sm text-muted-foreground">
                        Scheduled {data.assignment.serviceDate}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        setParams(
                          { tab: 'tracking' },
                          { replace: true, state: location.state as unknown },
                        )
                      }
                    >
                      View tracking
                      <ArrowRight className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="tracking">
              <div className="space-y-6">
                <div role="status">
                  <Badge variant="outline">
                    {isTerminal(data.status)
                      ? 'Delivery updates complete'
                      : connectionState === 'live'
                        ? 'Live updates connected'
                        : connectionState === 'polling'
                          ? 'Live connection interrupted · checking every few seconds'
                          : 'Connecting to live updates…'}
                  </Badge>
                </div>
                <DeliveryStepper status={data.status} />
                <Card>
                  <CardHeader>
                    <CardTitle>Delivery timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-5">
                      {data.history.map((entry, index) => (
                        <li
                          key={`${entry.timestamp}-${index}`}
                          className="space-y-1 border-l-2 pl-4"
                        >
                          <p className="text-sm font-medium">
                            {PARCEL_STATUS_LABELS[entry.toStatus]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(entry.timestamp)}
                          </p>
                          {entry.changeReason && (
                            <p className="text-sm">{entry.changeReason}</p>
                          )}
                          {entry.deliveryNote && (
                            <p className="text-sm text-muted-foreground">
                              {entry.deliveryNote}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="documents">
              {tab === 'documents' && <DeliveryDocuments parcel={data} />}
            </TabsContent>
          </Tabs>
        </>
      )}
    </WorkspacePage>
  );
}

export function CustomerTrackingHub() {
  const summary = useCustomerSummary();
  return (
    <WorkspacePage
      title="Track a delivery"
      actions={
        <Refresh
          refresh={() => void summary.refetch()}
          pending={summary.isFetching}
        />
      }
    >
      <OwnerTrackingLookup origin="/customer/tracking" />
      <Card>
        <CardHeader>
          <CardTitle>Active deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.isPending ? (
            <WorkspaceLoading label="Loading active deliveries" />
          ) : summary.isError || !summary.data ? (
            <WorkspaceNotice
              title="Unable to load deliveries"
              description="Your active deliveries could not be verified."
              destructive
              retry={() => void summary.refetch()}
            />
          ) : summary.data.activeDeliveries.length ? (
            <DeliveryRows
              items={summary.data.activeDeliveries}
              origin="/customer/tracking"
            />
          ) : (
            <WorkspaceNotice
              title="No active deliveries"
              description="Visit Delivery history for completed deliveries and documents."
            />
          )}
        </CardContent>
      </Card>
      <Button variant="outline" asChild>
        <Link to="/customer/history">
          Delivery history
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </WorkspacePage>
  );
}
