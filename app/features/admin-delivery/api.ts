import type { IdentitySession } from '../identity/session';
import { z } from 'zod';
import {
  zonePageSchema,
  zoneSchema,
  pricingPageSchema,
  pricingTierSchema,
  zoneSummaryResponseSchema,
  deliveryReportResponseSchema,
  type ZoneInput,
  type PricingTierInput,
} from './contracts';

const problemSchema = z.object({
  code: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});
export class AdminDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    readonly errors?: Record<string, string[]>,
  ) {
    super(AdminDeliveryError.resolveMessage(code, errors));
  }
  static resolveMessage(
    code: string,
    errors?: Record<string, string[]>,
  ): string {
    if (code === 'validation' && errors)
      return Object.values(errors).flat()[0] ?? 'Check the form fields.';
    switch (code) {
      case 'unauthorized':
        return 'Delivery could not verify access. Please retry or sign in again.';
      case 'forbidden':
        return 'Access denied. An Administrator account is required.';
      case 'overlapping_postal_codes':
        return 'These postal codes overlap another active delivery zone.';
      case 'conflict':
        return 'This configuration changed or already exists. Refresh it before trying again.';
      case 'invalid_date_range':
        return 'The date range is invalid; choose a range of no more than 366 days.';
      case 'not_found':
        return 'The requested configuration was not found.';
      case 'delivery_unavailable':
        return 'Delivery configuration is temporarily unavailable. Please try again.';
      default:
        return 'The delivery administration operation could not be completed. Please try again.';
    }
  }
}
export function createAdminDeliveryApi(session: IdentitySession) {
  const base = `${session.api.base}/v1`;
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    init?: RequestInit,
  ): Promise<T> {
    let response: Response;
    try {
      response = await session.authenticatedRequest(base + path, init);
    } catch {
      throw new AdminDeliveryError('delivery_unavailable');
    }
    if (!response.ok) {
      const problem = problemSchema.safeParse(
        await response.json().catch(() => null),
      );
      throw new AdminDeliveryError(
        problem.success ? (problem.data.code ?? 'unexpected') : 'unexpected',
        response.status,
        problem.success ? problem.data.errors : undefined,
      );
    }
    const result = schema.safeParse(await response.json().catch(() => null));
    if (!result.success)
      throw new AdminDeliveryError('invalid_response', response.status);
    return result.data;
  }
  const body = (method: string, value: unknown): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  const dates = (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.size ? `?${params}` : '';
  };
  return {
    listZones: (page = 1, pageSize = 20) =>
      request(`/zones?page=${page}&pageSize=${pageSize}`, zonePageSchema),
    createZone: (input: ZoneInput) =>
      request('/zones', zoneSchema, body('POST', input)),
    updateZone: (id: string, input: ZoneInput) =>
      request(
        `/zones/${encodeURIComponent(id)}`,
        zoneSchema,
        body('PUT', input),
      ),
    getZoneSummary: (from?: string, to?: string) =>
      request('/zones/summary' + dates(from, to), zoneSummaryResponseSchema),
    listPricingTiers: (page = 1, pageSize = 20, zoneId?: string) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (zoneId) params.set('zoneId', zoneId);
      return request(`/pricing-tiers?${params}`, pricingPageSchema);
    },
    createPricingTier: (input: PricingTierInput) =>
      request('/pricing-tiers', pricingTierSchema, body('POST', input)),
    updatePricingTierStatus: (
      id: string,
      isActive: boolean,
      expectedVersion: number,
    ) =>
      request(
        `/pricing-tiers/${encodeURIComponent(id)}`,
        pricingTierSchema,
        body('PUT', { isActive, expectedVersion }),
      ),
    getDeliveryReport: (from?: string, to?: string) =>
      request(
        '/reports/deliveries' + dates(from, to),
        deliveryReportResponseSchema,
      ),
  };
}
