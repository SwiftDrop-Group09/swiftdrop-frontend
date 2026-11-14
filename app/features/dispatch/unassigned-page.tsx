import { useRef, useState, type FormEvent, type Ref } from 'react';
import { Link } from 'react-router';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { ChevronDownIcon, RefreshCw } from 'lucide-react';
import { createAdminDeliveryApi } from '~/features/admin-delivery/api';
import type { CustomerParcelQuery } from '~/features/customer-tracking/contracts';
import { formatDateTime } from '~/features/customer-tracking/components';
import { useCustomerParcels } from '~/features/customer-tracking/hooks';
import { IdentityShell, Protected } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
import { WorkspacePage } from '~/shared/components/workspace-page';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Button } from '~/shared/components/ui/button';
import { Calendar } from '~/shared/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Field, FieldError } from '~/shared/components/ui/field';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/shared/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/shared/components/ui/popover';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';

const PAGE_SIZE = 20;
type Filters = Pick<CustomerParcelQuery, 'search' | 'from' | 'to' | 'zoneId'>;

// The supplied shadcn Date Picker composition, controlled by the queue's draft filters.
function BookingDatePicker({
  id,
  date,
  onSelect,
  error,
  triggerRef,
}: {
  id: string;
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  error?: string;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          id={id}
          type="button"
          variant="outline"
          data-empty={!date}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'unassigned-date-error' : undefined}
          className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
        >
          {date ? format(date, 'PPP') : <span>Pick a date</span>}
          <ChevronDownIcon aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        aria-labelledby={`${id}-label`}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          defaultMonth={date}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function UnassignedParcelsContent() {
  const { user, session } = useIdentity();
  const zones = useQuery({
    queryKey: ['delivery-zone-summary', user!.id],
    queryFn: () => createAdminDeliveryApi(session).getZoneSummary(),
  });
  const [search, setSearch] = useState('');
  const [zoneId, setZoneId] = useState('all');
  const [fromDate, setFromDate] = useState<Date>();
  const [throughDate, setThroughDate] = useState<Date>();
  const [dateError, setDateError] = useState<string>();
  const throughTrigger = useRef<HTMLButtonElement>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const query = useCustomerParcels(
    { ...filters, status: 'Created', page, pageSize: PAGE_SIZE },
    true,
  );
  const { data } = query;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE))
    : 1;
  const correctingPage = query.isSuccess && page > totalPages;
  // A concurrent assignment can remove the last row on the current page.
  if (correctingPage) setPage(totalPages);
  const hasFilters = Boolean(
    filters.search || filters.from || filters.to || filters.zoneId,
  );

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fromDate && throughDate && fromDate > throughDate) {
      setDateError('The through date must be on or after the from date.');
      throughTrigger.current?.focus();
      return;
    }
    // Calendar selection is a local calendar day. Send its UTC day boundaries.
    const end = throughDate
      ? new Date(`${format(throughDate, 'yyyy-MM-dd')}T00:00:00Z`)
      : undefined;
    end?.setUTCDate(end.getUTCDate() + 1);
    setFilters({
      zoneId: zoneId === 'all' ? undefined : zoneId,
      search: search.trim() || undefined,
      from: fromDate
        ? new Date(`${format(fromDate, 'yyyy-MM-dd')}T00:00:00Z`).toISOString()
        : undefined,
      to: end?.toISOString(),
    });
    setDateError(undefined);
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setZoneId('all');
    setFromDate(undefined);
    setThroughDate(undefined);
    setDateError(undefined);
    setFilters({});
    setPage(1);
  }

  return (
    <WorkspacePage
      title="Unassigned parcels"
      actions={
        <Button
          type="button"
          variant="outline"
          disabled={query.isFetching || zones.isFetching}
          onClick={() => {
            void query.refetch();
            void zones.refetch();
          }}
        >
          <RefreshCw aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Filter parcels</CardTitle>
          <CardDescription>
            Filter parcels awaiting courier assignment. Booking dates use UTC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilters} className="space-y-4">
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field className="min-w-0">
                <Label htmlFor="unassigned-search">
                  Tracking number or recipient
                </Label>
                <Input
                  id="unassigned-search"
                  type="search"
                  maxLength={128}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Field>
              <Field className="min-w-0">
                <Label htmlFor="unassigned-zone">Delivery zone</Label>
                <Select
                  value={zoneId}
                  onValueChange={setZoneId}
                  disabled={!zones.data || zones.data.zones.length === 0}
                >
                  <SelectTrigger
                    id="unassigned-zone"
                    className="w-full min-w-0"
                    aria-describedby={
                      zones.isPending ? 'unassigned-zones-loading' : undefined
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    align="start"
                    className="max-w-[calc(100vw-2rem)]"
                  >
                    <SelectItem value="all">All delivery zones</SelectItem>
                    {zones.data?.zones.map((zone) => (
                      <SelectItem
                        key={zone.zoneId}
                        value={zone.zoneId}
                        className="whitespace-normal break-all"
                      >
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {zones.isPending && (
                  <p
                    id="unassigned-zones-loading"
                    role="status"
                    className="text-sm text-muted-foreground"
                  >
                    Loading delivery zones…
                  </p>
                )}
              </Field>
              <Field className="min-w-0" data-invalid={Boolean(dateError)}>
                <Label id="unassigned-from-label" htmlFor="unassigned-from">
                  Booked from (UTC)
                </Label>
                <BookingDatePicker
                  id="unassigned-from"
                  date={fromDate}
                  error={dateError}
                  onSelect={(date) => {
                    setFromDate(date);
                    setDateError(undefined);
                  }}
                />
              </Field>
              <Field className="min-w-0" data-invalid={Boolean(dateError)}>
                <Label
                  id="unassigned-through-label"
                  htmlFor="unassigned-through"
                >
                  Booked through (UTC)
                </Label>
                <BookingDatePicker
                  triggerRef={throughTrigger}
                  id="unassigned-through"
                  date={throughDate}
                  error={dateError}
                  onSelect={(date) => {
                    setThroughDate(date);
                    setDateError(undefined);
                  }}
                />
              </Field>
            </div>
            {zones.isError && (
              <WorkspaceNotice
                destructive
                title={
                  zones.data
                    ? 'Unable to refresh delivery zones'
                    : 'Unable to load delivery zones'
                }
                description={
                  zones.data
                    ? 'Previously loaded zones and your selection are retained. Try again to refresh them.'
                    : 'Try again to load zone options. You can still use the other filters.'
                }
                retry={() => {
                  void zones.refetch();
                }}
                pending={zones.isFetching}
              />
            )}
            {zones.isSuccess && zones.data.zones.length === 0 && (
              <WorkspaceNotice
                title="No delivery zones available"
                description="You can still search the queue using the other filters."
              />
            )}
            {dateError && (
              <FieldError id="unassigned-date-error">{dateError}</FieldError>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit">Apply filters</Button>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Awaiting assignment</CardTitle>
          <CardDescription aria-live="polite">
            {data && !correctingPage
              ? `${data.totalCount} matching ${data.totalCount === 1 ? 'parcel' : 'parcels'}`
              : 'Created parcels, newest first.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4" aria-busy={query.isFetching}>
          {query.isPending || correctingPage ? (
            <WorkspaceLoading label="Loading unassigned parcels…" />
          ) : (
            <>
              {query.isError && (
                <WorkspaceNotice
                  destructive
                  title={
                    data
                      ? 'Unable to refresh unassigned parcels'
                      : 'Unable to load unassigned parcels'
                  }
                  description={
                    data
                      ? 'Previously loaded results are shown. Try again to get the latest queue.'
                      : 'Check your connection and try again.'
                  }
                  retry={() => {
                    void query.refetch();
                  }}
                  pending={query.isFetching}
                />
              )}
              {data && (
                <>
                  {query.isFetching && (
                    <p role="status" className="text-sm text-muted-foreground">
                      Refreshing parcels…
                    </p>
                  )}
                  {data.items.length === 0 ? (
                    <WorkspaceNotice
                      title={
                        hasFilters
                          ? 'No parcels match these filters'
                          : 'No parcels are awaiting assignment'
                      }
                      description={
                        hasFilters
                          ? 'Clear or adjust the filters to review more parcels.'
                          : 'New bookings will appear here when they are ready for courier assignment.'
                      }
                    />
                  ) : (
                    <Table className="min-w-[48rem] whitespace-nowrap">
                      <TableCaption className="sr-only">
                        Booked parcels awaiting courier assignment, newest
                        first.
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tracking number</TableHead>
                          <TableHead>Pickup → delivery</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Package size/weight</TableHead>
                          <TableHead>Booked</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.items.map((parcel) => (
                          <TableRow key={parcel.id}>
                            <TableCell className="font-mono text-xs">
                              {parcel.trackingNumber}
                            </TableCell>
                            <TableCell>
                              {parcel.pickupCity} → {parcel.deliveryCity}
                            </TableCell>
                            <TableCell>{parcel.recipientName}</TableCell>
                            <TableCell>
                              {parcel.packageDetails.size} ·{' '}
                              {parcel.packageDetails.weightKg} kg
                            </TableCell>
                            <TableCell>
                              {formatDateTime(parcel.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  to={`/dispatch/parcels/${encodeURIComponent(parcel.id)}`}
                                  aria-label={`View details for ${parcel.trackingNumber}`}
                                >
                                  View details
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {data.totalCount > 0 && (
                    <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                      </p>
                      <div
                        className="flex flex-wrap gap-2"
                        aria-label="Parcel pagination"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          disabled={page <= 1 || query.isFetching}
                          onClick={() => setPage(page - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={page >= totalPages || query.isFetching}
                          onClick={() => setPage(page + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}

export function UnassignedParcelsPage() {
  const { user } = useIdentity();
  return (
    <IdentityShell>
      <Protected roles={['Dispatcher', 'Admin']}>
        <UnassignedParcelsContent key={user?.id} />
      </Protected>
    </IdentityShell>
  );
}
