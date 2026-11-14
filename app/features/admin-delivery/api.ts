import { z } from 'zod';
import type { IdentitySession } from '../identity/session';
import {
  deliveryReportResponseSchema,
  pricingPageSchema,
  pricingTierSchema,
  zonePageSchema,
  zoneSchema,
  zoneSummaryResponseSchema,
  type DeliveryReportResponse,
  type PricingPage,
  type PricingTier,
  type PricingTierInput,
  type Zone,
  type ZoneInput,
  type ZonePage,
  type ZoneSummaryResponse,
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
    if (code === 'validation' && errors) {
      const message = Object.values(errors).flat()[0];
      if (message) return message;
    }

    switch (code) {
      case 'unauthorized':
        return 'Your session has expired. Please sign in again.';
      case 'forbidden':
        return 'Access denied. An Administrator account is required.';
      case 'overlapping_postal_codes':
        return 'These postal codes overlap another active delivery zone.';
      case 'conflict':
        return 'This configuration changed or already exists. Refresh it before trying again.';
      case 'invalid_date_range':
        return 'The date range is invalid; choose a UTC range of no more than 366 days.';
      case 'not_found':
        return 'The requested configuration was not found.';
      case 'delivery_unavailable':
        return 'Delivery configuration is temporarily unavailable. Please try again.';
      case 'invalid_response':
        return 'Delivery returned a response that could not be understood.';
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
    } catch (error) {
      if (error instanceof TypeError) {
        throw new AdminDeliveryError('delivery_unavailable');
      }
      throw error;
    }

    if (!response.ok) {
      const payload: unknown = await response.json().catch((error: unknown) => {
        if (error instanceof SyntaxError) return null;
        throw error;
      });
      const problem = problemSchema.safeParse(payload);

      throw new AdminDeliveryError(
        problem.success ? (problem.data.code ?? 'unexpected') : 'unexpected',
        response.status,
        problem.success ? problem.data.errors : undefined,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new AdminDeliveryError('invalid_response', response.status);
    }

    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new AdminDeliveryError('invalid_response', response.status);
    }
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
    return params.size > 0 ? `?${params.toString()}` : '';
  };

  return {
    listZones: (page = 1, pageSize = 20): Promise<ZonePage> =>
      request(`/zones?page=${page}&pageSize=${pageSize}`, zonePageSchema),

    createZone: (input: ZoneInput): Promise<Zone> =>
      request('/zones', zoneSchema, body('POST', input)),

    updateZone: (id: string, input: ZoneInput): Promise<Zone> =>
      request(
        `/zones/${encodeURIComponent(id)}`,
        zoneSchema,
        body('PUT', input),
      ),

    getZoneSummary: (
      from?: string,
      to?: string,
    ): Promise<ZoneSummaryResponse> =>
      request('/zones/summary' + dates(from, to), zoneSummaryResponseSchema),

    listPricingTiers: (
      page = 1,
      pageSize = 20,
      zoneId?: string,
    ): Promise<PricingPage> => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (zoneId) params.set('zoneId', zoneId);
      return request(`/pricing-tiers?${params.toString()}`, pricingPageSchema);
    },

    createPricingTier: (input: PricingTierInput): Promise<PricingTier> =>
      request('/pricing-tiers', pricingTierSchema, body('POST', input)),

    updatePricingTierStatus: (
      id: string,
      isActive: boolean,
      expectedVersion: number,
    ): Promise<PricingTier> =>
      request(
        `/pricing-tiers/${encodeURIComponent(id)}`,
        pricingTierSchema,
        body('PUT', { isActive, expectedVersion }),
      ),

    getDeliveryReport: (
      from?: string,
      to?: string,
    ): Promise<DeliveryReportResponse> =>
      request(
        '/reports/deliveries' + dates(from, to),
        deliveryReportResponseSchema,
      ),
  };
}
