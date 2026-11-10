import { useMemo } from 'react';
import { z } from 'zod';
import {
  oneTimeWebhookResponseSchema,
  webhookAttemptPageResponseSchema,
  webhookJobResponseSchema,
  webhookPageResponseSchema,
} from './contracts';
import type {
  CreateWebhookInput,
  OneTimeWebhookResponse,
  ReplayWebhookInput,
  WebhookAttemptPageResponse,
  WebhookJobResponse,
  WebhookPageResponse,
} from './contracts';
import { useIdentity } from '../identity/session';

export class WebhookError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    message?: string,
  ) {
    super(message ?? messageForWebhook(code));
  }
}

export function messageForWebhook(code: string): string {
  switch (code) {
    case 'forbidden':
      return 'Only approved merchants may manage delivery status webhooks.';
    case 'unauthenticated':
    case 'unauthorized':
      return 'A verified identity is required. Please sign in again.';
    case 'not_found':
      return 'The requested webhook subscription or job was not found.';
    case 'conflict':
      return 'A conflict occurred. Check maximum webhook limits or failed job status.';
    case 'invalid_input':
    case 'validation':
      return 'Please check the supplied endpoint URL and event selections.';
    default:
      return 'The webhook request could not be completed. Please try again.';
  }
}

async function handleResponseError(response: Response): Promise<WebhookError> {
  let code =
    response.status === 403
      ? 'forbidden'
      : response.status === 401
        ? 'unauthorized'
        : response.status === 404
          ? 'not_found'
          : response.status === 409
            ? 'conflict'
            : response.status === 400
              ? 'invalid_input'
              : 'unexpected_error';

  let customTitle: string | undefined;

  try {
    const value: unknown = await response.json();
    const problem = z
      .object({
        code: z.string().optional(),
        title: z.string().optional(),
        detail: z.string().optional(),
        errors: z.record(z.string(), z.array(z.string())).optional(),
      })
      .safeParse(value);

    if (problem.success) {
      if (problem.data.code) {
        code = problem.data.code;
      }
      if (problem.data.detail) {
        customTitle = problem.data.detail;
      } else if (problem.data.title) {
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
    // Keep fallback code/message
  }

  return new WebhookError(code, response.status, customTitle);
}

export class WebhookApi {
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
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new WebhookError(
        'network_error',
        0,
        'Network connection error. Check connectivity.',
      );
    }

    if (!response.ok) {
      throw await handleResponseError(response);
    }

    return response;
  }

  async createWebhook(
    input: CreateWebhookInput,
    token?: string,
  ): Promise<OneTimeWebhookResponse> {
    const response = await this.request(
      '/v1/merchant/webhooks',
      'POST',
      input,
      token,
    );
    return oneTimeWebhookResponseSchema.parse(await response.json());
  }

  async listWebhooks(
    page = 1,
    pageSize = 20,
    token?: string,
  ): Promise<WebhookPageResponse> {
    const response = await this.request(
      `/v1/merchant/webhooks?page=${page}&pageSize=${pageSize}`,
      'GET',
      undefined,
      token,
    );
    return webhookPageResponseSchema.parse(await response.json());
  }

  async deleteWebhook(id: string, token?: string): Promise<void> {
    await this.request(
      `/v1/merchant/webhooks/${id}`,
      'DELETE',
      undefined,
      token,
    );
  }

  async listAttempts(
    subscriptionId: string,
    page = 1,
    pageSize = 20,
    jobId?: string,
    token?: string,
  ): Promise<WebhookAttemptPageResponse> {
    const query = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    if (jobId) {
      query.set('jobId', jobId);
    }

    const response = await this.request(
      `/v1/merchant/webhooks/${subscriptionId}/attempts?${query.toString()}`,
      'GET',
      undefined,
      token,
    );
    return webhookAttemptPageResponseSchema.parse(await response.json());
  }

  async replayWebhook(
    subscriptionId: string,
    input: ReplayWebhookInput,
    token?: string,
  ): Promise<WebhookJobResponse> {
    const response = await this.request(
      `/v1/merchant/webhooks/${subscriptionId}/replays`,
      'POST',
      input,
      token,
    );
    return webhookJobResponseSchema.parse(await response.json());
  }
}

export function useWebhookApi(): WebhookApi {
  const { session } = useIdentity();
  return useMemo(() => new WebhookApi(session.authenticatedRequest), [session]);
}
