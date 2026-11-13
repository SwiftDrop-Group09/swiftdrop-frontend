import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { useMerchantBusiness } from './hooks';
import type { OrderState } from './contracts';

export const ORDER_STATE_LABELS: Record<OrderState, string> = {
  Accepted: 'Received',
  Retrying: 'Retrying',
  Created: 'Parcel created',
  Failed: 'Failed',
};

export const ORDER_STATE_DESCRIPTIONS: Record<OrderState, string> = {
  Accepted: 'SwiftDrop received the order and is creating the parcel.',
  Retrying:
    'Creating the parcel did not finish yet. SwiftDrop retries automatically; nothing is needed from you.',
  Created: 'The parcel exists and has a tracking number.',
  Failed:
    'SwiftDrop could not create a parcel for this order. Fix the cause and submit a new order.',
};

const STATE_STYLES: Record<OrderState, string> = {
  Accepted:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
  Retrying:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
  Created:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300',
  Failed:
    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300',
};

export function OrderStateBadge({ state }: { state: OrderState }) {
  return (
    <Badge variant="outline" className={STATE_STYLES[state]}>
      {ORDER_STATE_LABELS[state]}
    </Badge>
  );
}

/** Plain-language meaning of the safe error codes the backend stores on an order. */
const ERROR_TEXT: Record<string, string> = {
  pricing_changed:
    'The accepted price version no longer matches the current tariff. Fetch the current price and submit a new order.',
  invalid_order:
    'SwiftDrop rejected the order details. Check the addresses, zones, weight and size.',
  order_conflict:
    'An order with this external order ID already exists with different details.',
  invalid_stored_order:
    'The stored order could not be read. Contact SwiftDrop support with this order ID.',
  delivery_timeout: 'SwiftDrop did not answer in time. It will retry.',
  delivery_unavailable: 'SwiftDrop was temporarily unavailable. It will retry.',
  delivery_error: 'A temporary error occurred. SwiftDrop will retry.',
  delivery_not_configured:
    'Parcel creation is not yet connected in this environment. The order will be processed once it is.',
  delivery_unauthorized:
    'Parcel creation is paused by a SwiftDrop configuration problem. The order is kept and will be processed.',
};

export function describeOrderError(code: string): string {
  return ERROR_TEXT[code] ?? 'SwiftDrop recorded a problem with this order.';
}

/** "2026-11-13 09:40 UTC" — the portal shows server times in UTC, like the audit log. */
export function formatUtc(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function TrackingLink({ code }: { code: string }) {
  return (
    <Link
      className="font-mono text-sm underline-offset-4 hover:underline"
      to={`/track?code=${encodeURIComponent(code)}`}
    >
      {code}
    </Link>
  );
}

/**
 * Renders children only for an approved business; otherwise explains why the
 * page is unavailable (no business yet, pending, rejected or suspended).
 */
export function ApprovedBusinessGate({
  children,
  feature = 'orders',
}: {
  children: ReactNode;
  /** What the page shows, for the explanation text, e.g. "orders". */
  feature?: string;
}) {
  const business = useMerchantBusiness();

  if (business.isPending) {
    return <WorkspaceLoading label="Checking your business…" />;
  }

  if (business.isError) {
    return (
      <WorkspaceNotice
        destructive
        title="Unable to check your business"
        description={business.error.message}
        retry={() => void business.refetch()}
        pending={business.isFetching}
      />
    );
  }

  if (!business.data) {
    return (
      <div className="space-y-3">
        <WorkspaceNotice
          title="Register your business first"
          description={`Your ${feature} appear here after your business is registered and approved.`}
        />
        <Button asChild variant="outline">
          <Link to="/merchant">Go to business registration</Link>
        </Button>
      </div>
    );
  }

  if (business.data.status !== 'Approved') {
    return (
      <WorkspaceNotice
        destructive={business.data.status !== 'Pending'}
        title="Business approval required"
        description={`Only approved businesses can view ${feature}. Your business is currently ${business.data.status}.`}
      />
    );
  }

  return <>{children}</>;
}
