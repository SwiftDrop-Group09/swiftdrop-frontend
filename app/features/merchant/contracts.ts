import { z } from 'zod';

export const businessStatuses = [
  'Pending',
  'Approved',
  'Rejected',
  'Suspended',
] as const;

export type BusinessStatus = (typeof businessStatuses)[number];

export const apiKeyScopes = [
  'orders:write',
  'orders:read',
  'webhooks:manage',
] as const;

export type ApiKeyScope = (typeof apiKeyScopes)[number];

// ── Validation schemas ─────────────────────────────────────────────────────────

export const registerMerchantSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, 'Business name is required.')
    .max(200, 'Business name must not exceed 200 characters.'),
  contactEmail: z
    .string()
    .trim()
    .min(1, 'Contact email is required.')
    .email('Please enter a valid email address.')
    .max(254, 'Email must not exceed 254 characters.'),
  contactPhone: z
    .string()
    .trim()
    .min(1, 'Contact phone is required.')
    .max(32, 'Phone number must not exceed 32 characters.'),
  pickupAddress: z
    .string()
    .trim()
    .min(1, 'Pickup address is required.')
    .max(500, 'Pickup address must not exceed 500 characters.'),
});

export type RegisterMerchantInput = z.infer<typeof registerMerchantSchema>;

export const setMerchantStatusSchema = z.object({
  status: z.enum(['Approved', 'Rejected', 'Suspended'], {
    error: 'Status must be Approved, Rejected, or Suspended.',
  }),
  reason: z
    .string()
    .trim()
    .max(500, 'Reason must not exceed 500 characters.')
    .nullable()
    .optional(),
});

export type SetMerchantStatusInput = z.infer<typeof setMerchantStatusSchema>;

export const createApiKeySchema = z.object({
  scopes: z.preprocess(
    (val: unknown): unknown[] =>
      typeof val === 'string' ? [val] : Array.isArray(val) ? val : [],
    z
      .array(z.enum(apiKeyScopes))
      .min(1, 'Select at least one scope for the API key.'),
  ),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

// ── Response schemas ──────────────────────────────────────────────────────────

export const businessResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  businessName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  pickupAddress: z.string(),
  status: z.enum(businessStatuses),
  rejectionReason: z.string().nullable().optional(),
  registeredAt: z.string(),
  approvedAt: z.string().nullable().optional(),
  approvedBy: z.string().nullable().optional(),
});

export type BusinessResponse = z.infer<typeof businessResponseSchema>;

export const apiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  keyPrefix: z.string(),
  scopes: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string(),
  revokedAt: z.string().nullable().optional(),
});

export type ApiKeyResponse = z.infer<typeof apiKeyResponseSchema>;

export const oneTimeApiKeyResponseSchema = z.object({
  keyId: z.string().uuid(),
  apiKey: z.string(),
  scopes: z.array(z.string()),
});

export type OneTimeApiKeyResponse = z.infer<typeof oneTimeApiKeyResponseSchema>;
