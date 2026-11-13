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

  static resolveMessage(code: string, errors?: Record<string, string[]>): string {
    if (errors) {
      const [firstField] = Object.keys(errors);
      const messages = firstField ? errors[firstField] : undefined;
      const [firstMessage] = messages ?? [];
      if (firstMessage !== undefined) return firstMessage;
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
