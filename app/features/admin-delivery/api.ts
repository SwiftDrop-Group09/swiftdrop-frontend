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

export class AdminDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    readonly errors?: Record<string, string[]>,
  ) {
    super(AdminDeliveryError.resolveMessage(code, errors));
  }

  static resolveMessage(code: string, errors?: Record<string, string[]>): string {
    if (errors) {
      const [firstField] = Object.keys(errors);
      const messages = firstField ? errors[firstField] : undefined;
      const [firstMessage] = messages ?? [];
      if (firstMessage !== undefined) return firstMessage;
    }

    switch (code) {
      case 'unauthorized':
        return 'Your session has expired. Please sign in again.';
      case 'forbidden':
        return 'Access denied. You must be an Administrator to access delivery configuration and reports.';
      case 'overlapping_postal_codes':
        return 'The specified postal code(s) overlap with another active delivery zone.';
      case 'conflict':
        return 'A record with these unique properties already exists.';
      case 'invalid_date_range':
        return 'The specified report date range is invalid (maximum 366 days, end date must follow start date).';
      case 'not_found':
        return 'The requested resource was not found.';
      case 'validation':
        return 'One or more fields failed validation.';
      default:
        return 'The delivery administration operation could not be completed. Please try again.';
    }
  }
}

function isFieldErrors(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (messages) =>
        Array.isArray(messages) &&
        messages.every((message) => typeof message === 'string'),
    )
  );
}

async function handleResponse<T>(
  response: Response,
  parseSuccess: (data: unknown) => T,
): Promise<T> {
  if (response.ok) {
    const json: unknown = await response.json();
    return parseSuccess(json);
  }

  let code = 'unexpected';
  let errors: Record<string, string[]> | undefined;
  try {
    const problem: unknown = await response.json();
    if (typeof problem === 'object' && problem !== null && !Array.isArray(problem)) {
      const body = problem as Record<string, unknown>;
      if (typeof body.code === 'string') code = body.code;
      if (isFieldErrors(body.errors)) errors = body.errors;
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }

  throw new AdminDeliveryError(code, response.status, errors);
}

export function createAdminDeliveryApi(session: IdentitySession) {
  const authenticatedRequest = session.authenticatedRequest.bind(session);

  return {
    async listZones(page = 1, pageSize = 20): Promise<ZonePage> {
      const response = await authenticatedRequest(
        `/api/v1/zones?page=${page}&pageSize=${pageSize}`,
      );
      return handleResponse(response, (data) => zonePageSchema.parse(data));
    },

    async createZone(input: ZoneInput): Promise<Zone> {
      const response = await authenticatedRequest('/api/v1/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return handleResponse(response, (data) => zoneSchema.parse(data));
    },

    async updateZone(id: string, input: ZoneInput): Promise<Zone> {
      const response = await authenticatedRequest(`/api/v1/zones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return handleResponse(response, (data) => zoneSchema.parse(data));
    },

    async getZoneSummary(from?: string, to?: string): Promise<ZoneSummaryResponse> {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.toString();
      const response = await authenticatedRequest(
        `/api/v1/zones/summary${query ? `?${query}` : ''}`,
      );
      return handleResponse(response, (data) => zoneSummaryResponseSchema.parse(data));
    },

    async listPricingTiers(page = 1, pageSize = 20, zoneId?: string): Promise<PricingPage> {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (zoneId) params.set('zoneId', zoneId);
      const response = await authenticatedRequest(
        `/api/v1/pricing-tiers?${params.toString()}`,
      );
      return handleResponse(response, (data) => pricingPageSchema.parse(data));
    },

    async createPricingTier(input: PricingTierInput): Promise<PricingTier> {
      const response = await authenticatedRequest('/api/v1/pricing-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return handleResponse(response, (data) => pricingTierSchema.parse(data));
    },

    async updatePricingTierStatus(id: string, isActive: boolean): Promise<PricingTier> {
      const response = await authenticatedRequest(`/api/v1/pricing-tiers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      return handleResponse(response, (data) => pricingTierSchema.parse(data));
    },

    async getDeliveryReport(from?: string, to?: string): Promise<DeliveryReportResponse> {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.toString();
      const response = await authenticatedRequest(
        `/api/v1/reports/deliveries${query ? `?${query}` : ''}`,
      );
      return handleResponse(response, (data) => deliveryReportResponseSchema.parse(data));
    },
  };
}
