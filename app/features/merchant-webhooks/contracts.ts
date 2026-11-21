import { z } from 'zod';

export const webhookEvents = [
  'delivery.created',
  'delivery.assigned',
  'delivery.picked_up',
  'delivery.in_transit',
  'delivery.out_for_delivery',
  'delivery.delivered',
  'delivery.failed',
  'delivery.cancelled',
] as const;

export type WebhookEvent = (typeof webhookEvents)[number];

export const createWebhookSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Destination URL is required.')
    .max(2048, 'URL must not exceed 2048 characters.')
    .refine((val) => {
      try {
        const parsed = new URL(val);
        return (
          parsed.protocol === 'https:' &&
          (!parsed.port || parsed.port === '443')
        );
      } catch {
        return false;
      }
    }, 'Destination URL must be an absolute HTTPS URL on port 443.'),
  events: z
    .array(z.enum(webhookEvents))
    .min(1, 'Select at least one event type.'),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const oneTimeWebhookResponseSchema = z.object({
  id: z.string().uuid(),
  endpointUrl: z.string(),
  events: z.array(z.string()),
  secret: z.string(),
  secretVersion: z.number(),
  createdAt: z.string(),
});

export type OneTimeWebhookResponse = z.infer<
  typeof oneTimeWebhookResponseSchema
>;

export const webhookSubscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  endpointUrl: z.string(),
  events: z.array(z.string()),
  isActive: z.boolean(),
  secretVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WebhookSubscriptionResponse = z.infer<
  typeof webhookSubscriptionResponseSchema
>;

export const webhookPageResponseSchema = z.object({
  items: z.array(webhookSubscriptionResponseSchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type WebhookPageResponse = z.infer<typeof webhookPageResponseSchema>;

export const webhookAttemptResponseSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  attemptNumber: z.number(),
  requestedAt: z.string(),
  responseStatusCode: z.number().nullable(),
  durationMs: z.number(),
  nextRetryAt: z.string().nullable(),
  failureReason: z.string().nullable(),
});

export type WebhookAttemptResponse = z.infer<
  typeof webhookAttemptResponseSchema
>;

export const webhookAttemptPageResponseSchema = z.object({
  items: z.array(webhookAttemptResponseSchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type WebhookAttemptPageResponse = z.infer<
  typeof webhookAttemptPageResponseSchema
>;

export const replayWebhookSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'A business justification reason is required.')
    .max(500, 'Reason cannot exceed 500 characters.'),
  eventId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
});

export type ReplayWebhookInput = z.infer<typeof replayWebhookSchema>;

export const webhookJobResponseSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  replayGeneration: z.number(),
  status: z.string(),
  attemptCount: z.number(),
  dueAt: z.string(),
  safeErrorCode: z.string().nullable(),
  createdAt: z.string(),
});

export type WebhookJobResponse = z.infer<typeof webhookJobResponseSchema>;
