import { z } from 'zod';
import { PARCEL_STATUSES } from '../customer-tracking/contracts';

/** Lifecycle of a merchant order inside SwiftDrop (backend `InboxJobState`). */
export const orderStates = [
  'Accepted',
  'Retrying',
  'Created',
  'Failed',
] as const;
export type OrderState = (typeof orderStates)[number];

export const pageSizes = [20, 50, 100] as const;
export const defaultPageSize = 20;

// .NET serialises DateTimeOffset with an explicit offset (e.g. +00:00).
const timestamp = z.iso.datetime({ offset: true });

/**
 * OrderJob (swiftdrop-docs/api/rest-api.md). Parcel fields stay null until
 * Delivery confirms the parcel; the API never sends a placeholder tracking number.
 */
export const orderJobSchema = z.object({
  id: z.string().uuid(),
  externalOrderId: z.string(),
  state: z.enum(orderStates),
  attempts: z.number().int().nonnegative(),
  nextRetryAt: timestamp.nullable(),
  parcelId: z.string().uuid().nullable(),
  trackingNumber: z.string().nullable(),
  parcelStatus: z.enum(PARCEL_STATUSES).nullable(),
  parcelVersion: z.number().int().positive().nullable(),
  lastStatusChangedAt: timestamp.nullable(),
  terminalAt: timestamp.nullable(),
  errorCode: z.string().nullable(),
  lastRefreshedAt: timestamp.nullable(),
  createdAt: timestamp,
});
export type OrderJob = z.infer<typeof orderJobSchema>;

export const orderJobPageSchema = z.object({
  items: z.array(orderJobSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type OrderJobPage = z.infer<typeof orderJobPageSchema>;

export type OrderListQuery = {
  page: number;
  pageSize: number;
  state?: OrderState;
};

/**
 * MerchantDashboard (GET /api/v1/merchants/me/dashboard). Order counts cover
 * orders created in [from, to); terminal counts and rates cover parcels that
 * finished in [from, to). Rates are fractions (0.8824 = 88.24 %).
 */
export const merchantDashboardSchema = z.object({
  from: timestamp,
  to: timestamp,
  totalOrders: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  failedJobs: z.number().int().nonnegative(),
  // Lenient on keys so a new Delivery status never breaks the page; known ones are read by name.
  statusCounts: z.record(z.string(), z.number().int().nonnegative()),
  activeCount: z.number().int().nonnegative(),
  terminalDeliveredCount: z.number().int().nonnegative(),
  terminalFailedCount: z.number().int().nonnegative(),
  terminalCancelledCount: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(1),
  failureRate: z.number().min(0).max(1),
  lastRefreshedAt: timestamp.nullable(),
  recentOrders: z.array(orderJobSchema),
});
export type MerchantDashboard = z.infer<typeof merchantDashboardSchema>;

/** A UTC date range picked in the UI: both days inclusive, as YYYY-MM-DD. */
export type DashboardDays = { fromDay: string; toDay: string };

/** True while SwiftDrop is still turning the order into a parcel. */
export function isInProgress(state: OrderState): boolean {
  return state === 'Accepted' || state === 'Retrying';
}
