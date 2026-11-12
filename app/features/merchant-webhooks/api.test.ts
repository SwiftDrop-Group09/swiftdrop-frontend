import { describe, expect, it, vi } from 'vitest';
import { WebhookApi, WebhookError } from './api';

describe('WebhookApi', () => {
  const dummyUuid = '11111111-1111-4111-8111-111111111111';

  it('createWebhook calls POST /v1/merchant/webhooks and parses response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: dummyUuid,
          endpointUrl: 'https://example.com/webhook',
          events: ['delivery.delivered'],
          secret:
            'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          secretVersion: 1,
          createdAt: '2026-11-10T12:00:00Z',
        }),
    });

    const api = new WebhookApi(fetcher);
    const result = await api.createWebhook({
      url: 'https://example.com/webhook',
      events: ['delivery.delivered'],
    });

    expect(result.id).toBe(dummyUuid);
    expect(result.secretVersion).toBe(1);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/merchant/webhooks',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('listWebhooks calls GET /v1/merchant/webhooks with pagination', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [
            {
              id: dummyUuid,
              endpointUrl: 'https://example.com/webhook',
              events: ['delivery.delivered'],
              isActive: true,
              secretVersion: 1,
              createdAt: '2026-11-10T12:00:00Z',
              updatedAt: '2026-11-10T12:00:00Z',
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 20,
        }),
    });

    const api = new WebhookApi(fetcher);
    const result = await api.listWebhooks(1, 20);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.endpointUrl).toBe('https://example.com/webhook');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/merchant/webhooks?page=1&pageSize=20',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('deleteWebhook calls DELETE /v1/merchant/webhooks/:id', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
    });

    const api = new WebhookApi(fetcher);
    await api.deleteWebhook(dummyUuid);

    expect(fetcher).toHaveBeenCalledWith(
      `/api/v1/merchant/webhooks/${dummyUuid}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('listAttempts calls GET /v1/merchant/webhooks/:id/attempts', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [
            {
              id: dummyUuid,
              jobId: dummyUuid,
              attemptNumber: 1,
              requestedAt: '2026-11-10T12:00:00Z',
              responseStatusCode: 200,
              durationMs: 45,
              nextRetryAt: null,
              failureReason: null,
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 20,
        }),
    });

    const api = new WebhookApi(fetcher);
    const result = await api.listAttempts(dummyUuid, 1, 20);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.responseStatusCode).toBe(200);
  });

  it('replayWebhook calls POST /v1/merchant/webhooks/:id/replays', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: dummyUuid,
          eventId: dummyUuid,
          subscriptionId: dummyUuid,
          replayGeneration: 1,
          status: 'Pending',
          attemptCount: 0,
          dueAt: '2026-11-10T12:00:00Z',
          safeErrorCode: null,
          createdAt: '2026-11-10T12:00:00Z',
        }),
    });

    const api = new WebhookApi(fetcher);
    const result = await api.replayWebhook(dummyUuid, {
      reason: 'Outage resolved',
    });

    expect(result.replayGeneration).toBe(1);
    expect(result.status).toBe('Pending');
  });

  it('throws WebhookError with parsed problem details on 400 invalid input', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          code: 'invalid_input',
          detail: 'Destination URL must be an absolute HTTPS URL on port 443.',
        }),
    });

    const api = new WebhookApi(fetcher);
    await expect(
      api.createWebhook({
        url: 'http://insecure.com',
        events: ['delivery.delivered'],
      }),
    ).rejects.toThrow(WebhookError);
  });
});
