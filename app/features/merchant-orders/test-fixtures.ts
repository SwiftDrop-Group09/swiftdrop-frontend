import type { MerchantDashboard, OrderJob, OrderJobPage } from './contracts';

export const acceptedOrder: OrderJob = {
  id: '11111111-1111-4111-8111-111111111111',
  externalOrderId: 'ORD-1001',
  state: 'Accepted',
  attempts: 0,
  nextRetryAt: '2026-11-13T09:00:00+00:00',
  parcelId: null,
  trackingNumber: null,
  parcelStatus: null,
  parcelVersion: null,
  lastStatusChangedAt: null,
  terminalAt: null,
  errorCode: null,
  lastRefreshedAt: null,
  createdAt: '2026-11-13T09:00:00+00:00',
};

export const createdOrder: OrderJob = {
  ...acceptedOrder,
  id: '22222222-2222-4222-8222-222222222222',
  externalOrderId: 'ORD-1002',
  state: 'Created',
  attempts: 1,
  nextRetryAt: null,
  parcelId: '33333333-3333-4333-8333-333333333333',
  trackingNumber: 'SD-FICTION-01',
  parcelStatus: 'InTransit',
  parcelVersion: 4,
  lastStatusChangedAt: '2026-11-13T10:15:00+00:00',
  errorCode: null,
  lastRefreshedAt: '2026-11-13T10:20:00+00:00',
  createdAt: '2026-11-13T09:05:00.1234567+00:00',
};

export const failedOrder: OrderJob = {
  ...acceptedOrder,
  id: '44444444-4444-4444-8444-444444444444',
  externalOrderId: 'ORD-1003',
  state: 'Failed',
  attempts: 1,
  nextRetryAt: null,
  errorCode: 'pricing_changed',
};

export const retryingOrder: OrderJob = {
  ...acceptedOrder,
  id: '55555555-5555-4555-8555-555555555555',
  externalOrderId: 'ORD-1004',
  state: 'Retrying',
  attempts: 2,
  nextRetryAt: '2026-11-13T09:01:00+00:00',
  errorCode: 'delivery_timeout',
};

export function page(
  items: OrderJob[],
  totalCount = items.length,
  pageNumber = 1,
  pageSize = 20,
): OrderJobPage {
  return { items, totalCount, page: pageNumber, pageSize };
}

export const dashboard: MerchantDashboard = {
  from: '2026-11-01T00:00:00+00:00',
  to: '2026-11-14T00:00:00+00:00',
  totalOrders: 42,
  pendingCount: 3,
  failedJobs: 1,
  statusCounts: {
    Created: 4,
    Assigned: 6,
    PickedUp: 2,
    InTransit: 5,
    OutForDelivery: 3,
    Delivered: 15,
    Failed: 2,
    Cancelled: 1,
  },
  activeCount: 20,
  terminalDeliveredCount: 15,
  terminalFailedCount: 2,
  terminalCancelledCount: 1,
  successRate: 0.8824,
  failureRate: 0.1176,
  lastRefreshedAt: '2026-11-13T09:40:12+00:00',
  recentOrders: [createdOrder, acceptedOrder],
};
