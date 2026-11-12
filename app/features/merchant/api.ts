import { useMemo } from 'react';
import { z } from 'zod';
import {
  apiKeyResponseSchema,
  businessResponseSchema,
  oneTimeApiKeyResponseSchema,
} from './contracts';
import type {
  ApiKeyResponse,
  BusinessResponse,
  CreateApiKeyInput,
  OneTimeApiKeyResponse,
  RegisterMerchantInput,
  SetMerchantStatusInput,
} from './contracts';
import { useIdentity } from '../identity/session';

export class MerchantError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    message?: string,
  ) {
    super(message ?? messageForMerchant(code));
  }
}

export function messageForMerchant(code: string): string {
  switch (code) {
    case 'duplicate_business':
      return 'You already have a registered merchant business.';
    case 'business_not_approved':
      return 'Only approved merchants can generate or manage API keys.';
    case 'business_not_found':
      return 'The merchant business was not found.';
    case 'api_key_not_found':
      return 'The requested API key was not found.';
    case 'invalid_status_transition':
      return 'The requested status transition is not allowed.';
    case 'forbidden':
      return 'You do not have permission to perform this action.';
    case 'unauthorized':
      return 'A verified identity is required. Please sign in again.';
    case 'validation':
    case 'invalid_input':
      return 'Please check the supplied information and try again.';
    default:
      return 'The request could not be completed. Check your connection before trying again.';
  }
}

async function handleResponseError(response: Response): Promise<MerchantError> {
  let code =
    response.status === 403
      ? 'forbidden'
      : response.status === 401
        ? 'unauthorized'
        : response.status === 404
          ? 'not_found'
          : response.status === 409
            ? 'conflict'
            : 'request_failed';

  let customTitle: string | undefined;

  try {
    const value: unknown = await response.json();
    const problem = z
      .object({
        code: z.string().optional(),
        title: z.string().optional(),
        errors: z.record(z.string(), z.array(z.string())).optional(),
      })
      .safeParse(value);

    if (problem.success) {
      if (problem.data.code) {
        code = problem.data.code;
      }
      if (problem.data.title) {
        customTitle = problem.data.title;
      }
      if (problem.data.errors) {
        const firstField = Object.keys(problem.data.errors)[0];
        if (firstField && problem.data.errors[firstField]?.[0]) {
          customTitle = problem.data.errors[firstField][0];
        }
      }
    }
  } catch {
    // Keep default code/message if response body cannot be parsed as JSON
  }

  return new MerchantError(code, response.status, customTitle);
}

export class MerchantApi {
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

  private async request(
    path: string,
    method = 'GET',
    body?: unknown,
    token?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {};

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fullUrl = this.base + path;

    let response: Response;
    try {
      response = await this.fetcher(fullUrl, {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new MerchantError('network_error', 0, 'Network request failed.');
    }

    if (!response.ok) {
      throw await handleResponseError(response);
    }

    return response;
  }

  // ── Merchant Self-Service ───────────────────────────────────────────────────

  async registerMerchant(
    input: RegisterMerchantInput,
    token?: string,
  ): Promise<BusinessResponse> {
    const response = await this.request(
      '/v1/merchants/register',
      'POST',
      input,
      token,
    );
    return businessResponseSchema.parse(await response.json());
  }

  async getMyMerchant(token?: string): Promise<BusinessResponse | null> {
    try {
      const response = await this.request(
        '/v1/merchants/me',
        'GET',
        undefined,
        token,
      );
      return businessResponseSchema.parse(await response.json());
    } catch (error) {
      if (error instanceof MerchantError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // ── Admin Endpoints ─────────────────────────────────────────────────────────

  async listMerchants(token?: string): Promise<BusinessResponse[]> {
    const response = await this.request(
      '/v1/merchants',
      'GET',
      undefined,
      token,
    );
    return z.array(businessResponseSchema).parse(await response.json());
  }

  async setMerchantStatus(
    id: string,
    input: SetMerchantStatusInput,
    token?: string,
  ): Promise<BusinessResponse> {
    const response = await this.request(
      `/v1/merchants/${id}/status`,
      'PUT',
      input,
      token,
    );
    return businessResponseSchema.parse(await response.json());
  }

  // ── API Key Management ──────────────────────────────────────────────────────

  async createApiKey(
    input: CreateApiKeyInput,
    token?: string,
  ): Promise<OneTimeApiKeyResponse> {
    const response = await this.request(
      '/v1/merchants/api-keys',
      'POST',
      input,
      token,
    );
    return oneTimeApiKeyResponseSchema.parse(await response.json());
  }

  async listApiKeys(token?: string): Promise<ApiKeyResponse[]> {
    const response = await this.request(
      '/v1/merchants/api-keys',
      'GET',
      undefined,
      token,
    );
    return z.array(apiKeyResponseSchema).parse(await response.json());
  }

  async revokeApiKey(keyId: string, token?: string): Promise<void> {
    await this.request(
      `/v1/merchants/api-keys/${keyId}`,
      'DELETE',
      undefined,
      token,
    );
  }
}

export function useMerchantApi(): MerchantApi {
  const { session } = useIdentity();
  return useMemo(
    () => new MerchantApi(session.authenticatedRequest),
    [session],
  );
}
