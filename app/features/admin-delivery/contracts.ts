import { z } from 'zod';

export const zoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100),
  city: z.string().nullable().optional(),
  servicePostalCodes: z.array(z.string()),
  isActive: z.boolean(),
  version: z.number().int().min(1),
});

export type Zone = z.infer<typeof zoneSchema>;

export const zoneInputSchema = z.object({
  name: z.string().trim().min(1, 'Zone name is required.').max(100),
  city: z.string().trim().nullable().optional(),
  servicePostalCodes: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().default(true),
  expectedVersion: z.number().int().optional(),
});

export type ZoneInput = z.infer<typeof zoneInputSchema>;

export const zonePageSchema = z.object({
  items: z.array(zoneSchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
  cities: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
});

export type ZonePage = z.infer<typeof zonePageSchema>;

export const zoneSummaryItemSchema = z.object({
  zoneId: z.string().uuid(),
  name: z.string(),
  statusCounts: z.record(z.string(), z.number()),
  total: z.number(),
});

export const zoneSummaryResponseSchema = z.object({
  zones: z.array(zoneSummaryItemSchema),
});

export type ZoneSummaryResponse = z.infer<typeof zoneSummaryResponseSchema>;

export const parcelSizes = ['Small', 'Medium', 'Large'] as const;
export type ParcelSize = (typeof parcelSizes)[number];

export const pricingTierSchema = z.object({
  id: z.string().uuid(),
  zoneId: z.string().uuid(),
  zoneName: z.string(),
  size: z.enum(parcelSizes),
  pricingVersion: z.string().min(1),
  baseRate: z.number().min(0),
  perKgRate: z.number().min(0),
  currency: z.literal('LKR'),
  isActive: z.boolean(),
  version: z.number().int().positive(),
});

export type PricingTier = z.infer<typeof pricingTierSchema>;

export const pricingTierInputSchema = z.object({
  zoneId: z.string().uuid('Please select a valid zone.'),
  size: z.enum(parcelSizes),
  pricingVersion: z
    .string()
    .trim()
    .min(1, 'Pricing version identifier is required.'),
  baseRate: z.number().min(0, 'Base rate must be non-negative.'),
  perKgRate: z.number().min(0, 'Per kg rate must be non-negative.'),
  currency: z.literal('LKR').default('LKR'),
  isActive: z.boolean().default(true),
});

export type PricingTierInput = z.infer<typeof pricingTierInputSchema>;

export const pricingPageSchema = z.object({
  items: z.array(pricingTierSchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type PricingPage = z.infer<typeof pricingPageSchema>;

export const pricingOverviewSchema = z.object({
  items: z.array(
    z.object({
      zoneId: z.string().uuid(),
      zoneName: z.string(),
      isZoneActive: z.boolean(),
      tierCount: z.number().int().nonnegative(),
      activeTiers: z.array(pricingTierSchema),
    }),
  ),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type PricingZoneOverview = z.infer<
  typeof pricingOverviewSchema
>['items'][number];

export const dailyReportMetricSchema = z.object({
  date: z.string(),
  delivered: z.number(),
  failed: z.number(),
  cancelled: z.number(),
});

export type DailyReportMetric = z.infer<typeof dailyReportMetricSchema>;

export const deliveryReportResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  delivered: z.number(),
  failed: z.number(),
  cancelled: z.number(),
  terminalCount: z.number(),
  successRate: z.number(),
  failureRate: z.number(),
  days: z.array(dailyReportMetricSchema),
});

export type DeliveryReportResponse = z.infer<
  typeof deliveryReportResponseSchema
>;
