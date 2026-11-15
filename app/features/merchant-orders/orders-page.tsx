import { Link, useSearchParams } from 'react-router';
import { KeyRound, RefreshCw } from 'lucide-react';
import { IdentityShell, Protected } from '../identity/components';
import { StatusBadge } from '../customer-tracking/components';
import { WorkspacePage } from '~/shared/components/workspace-page';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
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
  defaultPageSize,
  orderStates,
  pageSizes,
  type OrderListQuery,
  type OrderState,
} from './contracts';
import { useMerchantOrders } from './hooks';
import {
  ApprovedBusinessGate,
  formatUtc,
  ORDER_STATE_LABELS,
  OrderStateBadge,
  TrackingLink,
} from './order-display';

/**
 * Reads page, pageSize and state from the URL so a filtered view survives
 * reloads and the back button. Unknown values fall back to defaults.
 */
function readQuery(params: URLSearchParams): OrderListQuery {
  const page = Number(params.get('page'));
  const pageSize = Number(params.get('pageSize'));
  const state = params.get('state');
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: (pageSizes as readonly number[]).includes(pageSize)
      ? pageSize
      : defaultPageSize,
    state: (orderStates as readonly string[]).includes(state ?? '')
      ? (state as OrderState)
      : undefined,
  };
}

export function OrdersPage() {
  return (
    <Protected roles={['Merchant']}>
      <IdentityShell>
        <WorkspacePage
          title="Orders"
          description="Orders your store submitted to SwiftDrop with an API key. Your systems create orders; this view lets you follow them."
        >
          <ApprovedBusinessGate>
            <OrdersContent />
          </ApprovedBusinessGate>
        </WorkspacePage>
      </IdentityShell>
    </Protected>
  );
}

function OrdersContent() {
  const [params, setParams] = useSearchParams();
  const query = readQuery(params);
  const orders = useMerchantOrders(query, true);

  function update(changes: Partial<OrderListQuery>) {
    const next = { ...query, ...changes };
    const search = new URLSearchParams();
    if (next.page > 1) search.set('page', String(next.page));
    if (next.pageSize !== defaultPageSize)
      search.set('pageSize', String(next.pageSize));
    if (next.state) search.set('state', next.state);
    setParams(search);
  }

  const totalPages = orders.data
    ? Math.max(1, Math.ceil(orders.data.totalCount / orders.data.pageSize))
    : 1;

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Submitted orders</CardTitle>
          <CardDescription>
            Newest first. Times are UTC. Parcel status is refreshed
            periodically, so it may be a few minutes behind.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="orders-state">Order state</Label>
            <NativeSelect
              id="orders-state"
              value={query.state ?? ''}
              onChange={(event) =>
                update({
                  state: (event.target.value || undefined) as
                    OrderState | undefined,
                  page: 1,
                })
              }
            >
              <NativeSelectOption value="">All states</NativeSelectOption>
              {orderStates.map((state) => (
                <NativeSelectOption key={state} value={state}>
                  {ORDER_STATE_LABELS[state]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button
            variant="outline"
            disabled={orders.isFetching}
            onClick={() => void orders.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {orders.isPending ? (
          <WorkspaceLoading label="Loading orders…" />
        ) : orders.isError ? (
          <WorkspaceNotice
            destructive
            title="Unable to load orders"
            description={orders.error.message}
            retry={() => void orders.refetch()}
            pending={orders.isFetching}
          />
        ) : orders.data.items.length === 0 ? (
          <EmptyOrders filtered={!!query.state || query.page > 1} />
        ) : (
          <>
            <p role="status" className="text-sm text-muted-foreground">
              {orders.data.totalCount}{' '}
              {orders.data.totalCount === 1 ? 'order' : 'orders'} · Page{' '}
              {orders.data.page} of {totalPages}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>External order ID</TableHead>
                  <TableHead>Order state</TableHead>
                  <TableHead>Tracking number</TableHead>
                  <TableHead>Parcel status</TableHead>
                  <TableHead>Submitted (UTC)</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.data.items.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="max-w-56 break-all font-mono text-xs">
                      {order.externalOrderId}
                    </TableCell>
                    <TableCell>
                      <OrderStateBadge state={order.state} />
                    </TableCell>
                    <TableCell>
                      {order.trackingNumber ? (
                        <TrackingLink code={order.trackingNumber} />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Not yet assigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.parcelStatus ? (
                        <StatusBadge status={order.parcelStatus} />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatUtc(order.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to={`/merchant/orders/${order.id}`}
                          aria-label={`View order ${order.externalOrderId}`}
                        >
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
        {orders.data && orders.data.totalCount > 0 && (
          <nav
            aria-label="Orders pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <Label htmlFor="orders-size">Rows</Label>
              <NativeSelect
                id="orders-size"
                value={query.pageSize}
                onChange={(event) =>
                  update({ pageSize: Number(event.target.value), page: 1 })
                }
              >
                {pageSizes.map((size) => (
                  <NativeSelectOption key={size} value={size}>
                    {size}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={query.page <= 1 || orders.isFetching}
                onClick={() => update({ page: query.page - 1 })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={query.page >= totalPages || orders.isFetching}
                onClick={() => update({ page: query.page + 1 })}
              >
                Next
              </Button>
            </div>
          </nav>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyOrders({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <WorkspaceNotice
        title="No matching orders"
        description="No orders match this filter or page. Choose another state or go back to the first page."
      />
    );
  }

  return (
    <div className="space-y-3">
      <WorkspaceNotice
        title="No orders yet"
        description="Orders appear here after your store sends them to POST /api/v1/merchant/orders with an API key that has the orders:write scope."
      />
      <Button asChild variant="outline">
        <Link to="/merchant">
          <KeyRound aria-hidden="true" />
          Manage API keys
        </Link>
      </Button>
    </div>
  );
}
