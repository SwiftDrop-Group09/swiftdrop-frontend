import { z } from 'zod';

export const roles = [
  'Customer',
  'Courier',
  'Merchant',
  'Dispatcher',
  'Admin',
] as const;
export const profileSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  fullName: z.string(),
  phoneNumber: z.string().nullable(),
  address: z.string().nullable(),
  roles: z.array(z.enum(roles)),
  isActive: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;
export const tokenSchema = z
  .object({
    accessToken: z.string().min(1),
    tokenType: z.literal('Bearer'),
    expiresInSeconds: z.number().int().positive().max(900),
    user: profileSchema,
  })
  .refine((value) => value.user.isActive);
export type TokenPair = z.infer<typeof tokenSchema>;
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    totalCount: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive().max(100),
  });
export type Page<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};
export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
export const registrationSchema = loginSchema.extend({
  password: z.string().min(12, 'Use at least 12 characters.').max(128),
  fullName: z.string().trim().min(1, 'Enter your full name.').max(120),
});
export const profileInputSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your full name.').max(120),
  phoneNumber: z.string().max(32),
  address: z.string(),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;
export const adminInputSchema = z.object({
  email: z.email().max(254),
  fullName: z.string().trim().min(1).max(120),
  isActive: z.boolean(),
});
export type AdminInput = z.infer<typeof adminInputSchema>;
export const auditSchema = z.object({
  id: z.number().int().safe(),
  actorId: z.string().nullable(),
  action: z.string(),
  resourceId: z.string().nullable(),
  timestamp: z.iso.datetime(),
  resultCode: z.string(),
});
export type AuditRecord = z.infer<typeof auditSchema>;
export type AuthenticatedRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
