import { useMemo } from 'react';
import { z } from 'zod';
import { useIdentity } from '../identity/session';
import {
  merchantDashboardSchema,
  orderJobPageSchema,
  orderJobSchema,
  type MerchantDashboard,
  type OrderJob,
  type OrderJobPage,
  type OrderListQuery,
} from './contracts';

export class MerchantOrdersError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
  ) {
    super(messageForOrders(code));
  }
}

export function messageForOrders(code: string): string {
  switch (code) {
    case 'order_not_found':
    case 'not_found':
      return 'This order was not found. Check the link, or the order may belong to another business.';
    case 'forbidden':
      return 'Only approved merchant businesses can view orders.';
    case 'unauthorized':
      return 'A verified identity is required. Please sign in again.';
    case 'validation':
      return 'The filters are invalid. Choose a range of at most 366 days and try again.';
    case 'invalid_response':
      return 'SwiftDrop returned an unexpected response. Try again shortly.';
    case 'network_error':
      return 'SwiftDrop could not be reached. Check your connection and try again.';
    default:
      return 'The orders could not be loaded. Try again shortly.';
  }
}

const problemSchema = z.object({ code: z.string() });

/**
 * Read-only client for the merchant order endpoints. Orders are submitted by
 * the merchant's own systems with an API key, so the web portal only reads them.
 */
export class MerchantOrdersApi {
  readonly base: string;

  constructor(
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
    base = '/api',
  ) {
    if (!base.startsWith('/') || base.startsWith('//') || /[?#\\]/.test(base)) {
      throw new Error('Use a same-origin API path.');
    }
    this.base = base.replace(/\/$/, '');
  }

  async listOrders(
    query: OrderListQuery,
    signal?: AbortSignal,
  ): Promise<OrderJobPage> {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    if (query.state) params.set('state', query.state);
    return this.read(
      `/v1/merchant/orders?${params.toString()}`,
      orderJobPageSchema,
      signal,
    );
  }

  async getOrder(id: string, signal?: AbortSignal): Promise<OrderJob> {
    if (!z.string().uuid().safeParse(id).success) {
      throw new MerchantOrdersError('order_not_found', 404);
    }
    return this.read(
      `/v1/merchant/orders/${encodeURIComponent(id)}`,
      orderJobSchema,
      signal,
    );
  }

  /** Dashboard for [from, to) in UTC; the server enforces at most 366 days. */
  async getDashboard(
    range: { from: string; to: string },
    signal?: AbortSignal,
  ): Promise<MerchantDashboard> {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    return this.read(
      `/v1/merchants/me/dashboard?${params.toString()}`,
      merchantDashboardSchema,
      signal,
    );
  }

  private async read<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(this.base + path, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new MerchantOrdersError('network_error');
    }

    if (!response.ok) throw await toError(response);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new MerchantOrdersError('invalid_response', response.status);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new MerchantOrdersError('invalid_response', response.status);
    }
    return parsed.data;
  }
}

async function toError(response: Response): Promise<MerchantOrdersError> {
  const fallback =
    response.status === 401
      ? 'unauthorized'
      : response.status === 403
        ? 'forbidden'
        : response.status === 404
          ? 'not_found'
          : 'request_failed';
  try {
    const problem = problemSchema.safeParse(await response.json());
    return new MerchantOrdersError(
      problem.success ? problem.data.code : fallback,
      response.status,
    );
  } catch {
    return new MerchantOrdersError(fallback, response.status);
  }
}

export function useMerchantOrdersApi(): MerchantOrdersApi {
  const { session } = useIdentity();
  return useMemo(
    () => new MerchantOrdersApi(session.authenticatedRequest),
    [session],
  );
}
