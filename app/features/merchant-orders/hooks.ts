import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useIdentity } from '../identity/session';
import { useMerchantApi } from '../merchant/api';
import { useMerchantOrdersApi } from './api';
import {
  isInProgress,
  type DashboardDays,
  type OrderListQuery,
} from './contracts';
import { toApiRange } from './dashboard-range';

/** Parcel data older than this is labelled as possibly out of date. */
export const STALE_AFTER_MINUTES = 15;

/** How often an in-progress order is re-checked on its detail page. */
export const IN_PROGRESS_POLL_MS = 15_000;

/** The refresh loop updates parcel status on the server every few minutes. */
export const PARCEL_STATUS_MAX_AGE_MINUTES = 5;

export const merchantOrderKeys = {
  all: (userId: string | undefined) => ['merchant', 'orders', userId] as const,
  dashboard: (userId: string | undefined, days: DashboardDays) =>
    ['merchant', 'dashboard', userId, days.fromDay, days.toDay] as const,
  list: (userId: string | undefined, query: OrderListQuery) =>
    [...merchantOrderKeys.all(userId), 'list', query] as const,
  detail: (userId: string | undefined, id: string) =>
    [...merchantOrderKeys.all(userId), 'detail', id] as const,
};

/**
 * The signed-in user's business. Same key as the webhook and API-key screens,
 * so the result is shared across the merchant portal.
 */
export function useMerchantBusiness() {
  const { user, restoring } = useIdentity();
  const api = useMerchantApi();
  return useQuery({
    queryKey: ['merchant', 'me', user?.id],
    enabled: !restoring && !!user?.roles.includes('Merchant'),
    queryFn: () => api.getMyMerchant(),
  });
}

export function useMerchantOrders(query: OrderListQuery, enabled: boolean) {
  const { user } = useIdentity();
  const api = useMerchantOrdersApi();
  return useQuery({
    queryKey: merchantOrderKeys.list(user?.id, query),
    enabled: enabled && !!user,
    queryFn: ({ signal }) => api.listOrders(query, signal),
    // Keep the current page visible while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export function useMerchantDashboard(days: DashboardDays, enabled: boolean) {
  const { user } = useIdentity();
  const api = useMerchantOrdersApi();
  return useQuery({
    queryKey: merchantOrderKeys.dashboard(user?.id, days),
    enabled: enabled && !!user,
    queryFn: ({ signal }) => api.getDashboard(toApiRange(days), signal),
    placeholderData: keepPreviousData,
  });
}

export function useMerchantOrder(id: string, enabled: boolean) {
  const { user } = useIdentity();
  const api = useMerchantOrdersApi();
  return useQuery({
    queryKey: merchantOrderKeys.detail(user?.id, id),
    enabled: enabled && !!user,
    queryFn: ({ signal }) => api.getOrder(id, signal),
    // Poll only while SwiftDrop is still creating the parcel.
    refetchInterval: (query) =>
      query.state.data && isInProgress(query.state.data.state)
        ? IN_PROGRESS_POLL_MS
        : false,
  });
}
