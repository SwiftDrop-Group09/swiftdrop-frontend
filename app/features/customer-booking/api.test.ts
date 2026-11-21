import { describe, expect, it, vi } from 'vitest';
import {
  confirmationBody,
  CustomerBookingApi,
  validPendingAttempt,
} from './api';
import type { PendingAttempt } from './contracts';
import { emptyBookingForm } from './validation';
import { tabAttemptStore } from '../../../test-harness/attempt-store';

const owner = '11111111-1111-4111-8111-111111111111';
const quoteId = '22222222-2222-4222-8222-222222222222';
const total = '90071992547409.93';
const attempt: PendingAttempt = {
  ownerId: owner,
  quoteId,
  total,
  key: 'fixture-confirmation',
  body: confirmationBody(quoteId, total),
};

describe('booking API contracts and attempt retention', () => {
  it('posts exact quote numbers and only documented fields', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(
          `{"quoteId":"${quoteId}","total":${total},"currency":"LKR","pricingVersion":"test-v1","expiresAt":"2026-10-24T12:10:00Z","fingerprint":"opaque"}`,
        ),
      );
    const api = new CustomerBookingApi(request);
    const quote = await api.estimate({
      ...emptyBookingForm,
      pickupZoneId: owner,
      deliveryZoneId: quoteId,
      weightKg: '2.5000833333333333333333333333',
      recipientName: 'Fixture recipient',
    });
    expect(quote.total).toBe(total);
    expect(request).toHaveBeenCalledWith(
      '/api/v1/quotes',
      expect.objectContaining({ method: 'POST' }),
    );
    const init = request.mock.calls[0]![1] as RequestInit;
    expect(init.body).toContain('"weightKg":2.5000833333333333333333333333');
    expect(init.body).not.toContain('ownerId');
    expect(
      Object.keys(JSON.parse(init.body as string) as object).sort(),
    ).toEqual([
      'deliveryAddress',
      'packageDetails',
      'pickupAddress',
      'recipient',
    ]);
  });

  it('sends the retained confirmation body/key and keeps a large receipt exact', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(
          `{"id":"33333333-3333-4333-8333-333333333333","trackingNumber":"server-issued-fixture","status":"Created","version":1,"priceSnapshot":{"total":${total},"currency":"LKR","pricingVersion":"test-v1"},"createdAt":"2026-10-24T12:00:00Z"}`,
          { status: 201 },
        ),
      );
    const result = await new CustomerBookingApi(request, '/api/').confirm(
      attempt,
    );
    expect(request).toHaveBeenCalledWith('/api/v1/parcels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': attempt.key,
      },
      body: attempt.body,
    });
    expect(result.priceSnapshot.total).toBe(total);
    expect(result.trackingNumber).toBe('server-issued-fixture');
  });

  it('does not treat a malformed 201 as a verified booking', async () => {
    const api = new CustomerBookingApi(() =>
      Promise.resolve(
        new Response('{"trackingNumber":"incomplete"}', { status: 201 }),
      ),
    );
    await expect(api.confirm(attempt)).rejects.toMatchObject({
      code: 'unreadable_response',
      status: 201,
    });
  });

  it('rejects numeric strings from a quote response', async () => {
    const api = new CustomerBookingApi(() =>
      Promise.resolve(
        new Response(
          `{"quoteId":"${quoteId}","total":"540.00","currency":"LKR","pricingVersion":"test-v1","expiresAt":"2026-10-24T12:10:00Z","fingerprint":"opaque"}`,
        ),
      ),
    );
    await expect(
      api.estimate({ ...emptyBookingForm, weightKg: '1' }),
    ).rejects.toMatchObject({ code: 'unreadable_response' });
  });

  it('parses safe ProblemDetails and Retry-After without exposing raw errors', async () => {
    const api = new CustomerBookingApi(() =>
      Promise.resolve(
        new Response(
          '{"code":"operation_in_progress","private":"do-not-display"}',
          { status: 409, headers: { 'Retry-After': '1' } },
        ),
      ),
    );
    await expect(api.confirm(attempt)).rejects.toMatchObject({
      code: 'operation_in_progress',
      retryAfterSeconds: 1,
      status: 409,
      message: 'The booking request could not be completed.',
    });
  });

  it.each(['01', '-1', 'NaN', '10000000000000000', '1.001'])(
    'never throws or accepts corrupted stored amount %s',
    (badTotal) => {
      expect(validPendingAttempt({ ...attempt, total: badTotal }, owner)).toBe(
        false,
      );
    },
  );

  it('restores only the same owner and clears corrupted test-only storage', () => {
    sessionStorage.clear();
    const store = tabAttemptStore(sessionStorage);
    store.write(attempt);
    expect(store.read(owner)).toEqual(attempt);
    expect(store.read('44444444-4444-4444-8444-444444444444')).toBeNull();
    expect(store.read(owner)).toBeNull();
    sessionStorage.setItem(
      'swiftdrop.booking-test.pending',
      JSON.stringify({ ...attempt, total: '01' }),
    );
    expect(store.read(owner)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
