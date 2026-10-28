import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CourierApi,
  CourierError,
  proofAttempt,
  statusAttempt,
  summarySchema,
} from './api';
import { CourierWorkflow } from './workflow';
import { parseExactJson } from '~/shared/exact-json';
import { detail, id, page, privateRaw, raw, response } from './test-fixtures';
import { IdentityError } from '~/features/identity/api';
afterEach(() => vi.useRealTimers());
describe('Courier contract adapter', () => {
  it.each([201, 202])(
    'does not confirm delivery from an undocumented %s response',
    async (status) => {
      const api = new CourierApi(
        vi.fn().mockResolvedValue(response(raw('Delivered', 6), status)),
      );
      await expect(
        api.submit(
          proofAttempt(
            detail('OutForDelivery', 5),
            'Recipient',
            new File(['p'], 'p.png', { type: 'image/png' }),
          ),
        ),
      ).rejects.toMatchObject({ code: 'invalid_response', status: 0 });
    },
  );
  it('retains network/refresh failures as uncertain and distinguishes revoked sessions', async () => {
    const api = new CourierApi(
      vi.fn().mockRejectedValue(new IdentityError('network_error')),
    );
    await expect(
      api.submit(statusAttempt(detail(), 'PickedUp', 'Collected')),
    ).rejects.toMatchObject({ code: 'network', status: 0 });
    const denied = new CourierApi(
      vi.fn().mockRejectedValue(new IdentityError('session_changed')),
    );
    await expect(denied.detail(id)).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });
  it('uses the authenticated request port and canonical read routes', async () => {
    const request = vi.fn().mockResolvedValue(response(page([privateRaw()])));
    const api = new CourierApi(request);
    const m = await api.manifest('2026-10-29', false, 2);
    expect(m.items[0]?.version).toBe('2');
    expect(request.mock.calls[0]?.[0]).toBe(
      '/api/v1/couriers/me/assignments?includeOverdue=false&page=2&pageSize=20&date=2026-10-29',
    );
    request.mockResolvedValue(response(page([raw('Failed', 3)])));
    await api.history();
    expect(request.mock.calls[1]?.[0]).toBe(
      '/api/v1/couriers/me/history?page=1&pageSize=20',
    );
    request.mockResolvedValue(response(privateRaw()));
    await api.detail(id);
    expect(request.mock.calls[2]?.[0]).toBe(`/api/v1/parcels/${id}`);
  });
  it('preserves long versions and 18-digit prices without binary rounding', () => {
    const json = JSON.stringify(raw())
      .replace('"version":2', '"version":9007199254740993')
      .replace('"total":540', '"total":9999999999999999.99');
    const d = summarySchema.parse(parseExactJson(json));
    expect(d.version).toBe('9007199254740993');
    expect(d.priceSnapshot.total).toBe('9999999999999999.99');
  });
  it.each([
    ['Assigned', 'PickedUp'],
    ['PickedUp', 'InTransit'],
    ['InTransit', 'OutForDelivery'],
  ])('allows %s to %s with a private note', (from, to) => {
    expect(
      statusAttempt(detail(from), to as 'PickedUp', ' Collected ').body,
    ).toContain('"notes":"Collected"');
  });
  it.each(['Created', 'Delivered', 'Failed', 'Cancelled'])(
    'has no action from %s',
    (s) => {
      expect(() => statusAttempt(detail(s), 'Failed', '', 'Other')).toThrow(
        CourierError,
      );
    },
  );
  it('rejects a skipped stage, blank note, long note and direct Delivered', () => {
    for (const [s, n] of [
      ['InTransit', 'note'],
      ['PickedUp', ' '],
      ['PickedUp', 'x'.repeat(501)],
      ['Delivered', 'note'],
    ])
      expect(() => statusAttempt(detail(), s as 'PickedUp', n!)).toThrow(
        CourierError,
      );
  });
  it('requires an explicit failure reason and retains optional notes', () => {
    expect(() => statusAttempt(detail(), 'Failed', '')).toThrow();
    const a = statusAttempt(
      detail(),
      'Failed',
      'Door closed',
      'RecipientUnavailable',
    );
    expect(JSON.parse(a.body!)).toMatchObject({
      failureReason: 'RecipientUnavailable',
      notes: 'Door closed',
      expectedVersion: 2,
    });
  });
  it.each(['photo', 'signature', 'both'])('accepts %s proof', async (kind) => {
    const f = new File(['PNG'], 'proof.png', { type: 'image/png' });
    const a = proofAttempt(
      detail('OutForDelivery', 5),
      ' Recipient ',
      kind !== 'signature' ? f : undefined,
      kind !== 'photo' ? f : undefined,
    );
    const request = vi.fn().mockResolvedValue(response(raw('Delivered', 6)));
    await new CourierApi(request).submit(a);
    const init = request.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).not.toHaveProperty('Content-Type');
    const body = init.body as FormData;
    expect(body.get('recipientName')).toBe('Recipient');
    expect(body.get('expectedVersion')).toBe('5');
    expect(body.has('photo')).toBe(kind !== 'signature');
    expect(body.has('signature')).toBe(kind !== 'photo');
  });
  it('rejects absent proof, blank name, wrong state, MIME and oversized files', () => {
    const f = new File(['ok'], 'p.png', { type: 'image/png' });
    expect(() => proofAttempt(detail('OutForDelivery'), 'Recipient')).toThrow();
    expect(() => proofAttempt(detail('OutForDelivery'), ' ', f)).toThrow();
    expect(() => proofAttempt(detail(), 'Recipient', f)).toThrow();
    expect(() =>
      proofAttempt(
        detail('OutForDelivery'),
        'Recipient',
        new File(['x'], 'x.txt', { type: 'text/plain' }),
      ),
    ).toThrow();
    expect(() =>
      proofAttempt(
        detail('OutForDelivery'),
        'Recipient',
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'p.png', {
          type: 'image/png',
        }),
      ),
    ).toThrow();
  });
  it('never accepts upload completion without the matching confirmed receipt', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(response(raw('OutForDelivery', 5)));
    const api = new CourierApi(request);
    await expect(
      api.submit(
        proofAttempt(
          detail('OutForDelivery', 5),
          'Recipient',
          new File(['p'], 'p.png', { type: 'image/png' }),
        ),
      ),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('does not display raw error contents', async () => {
    const api = new CourierApi(
      vi
        .fn()
        .mockResolvedValue(
          response(
            { code: 'stale_version', detail: 'SECRET private data' },
            409,
          ),
        ),
    );
    await expect(api.detail(id)).rejects.toThrow('This parcel changed');
    try {
      await api.detail(id);
    } catch (e) {
      expect(String(e)).not.toContain('SECRET');
    }
  });
});
describe('Courier mutation concurrency', () => {
  it('freezes a network-uncertain request and explicitly retries the identical key/body', async () => {
    vi.useFakeTimers();
    const request = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(response(raw('PickedUp', 3)));
    const w = new CourierWorkflow(new CourierApi(request));
    const a = statusAttempt(detail(), 'PickedUp', 'Collected');
    expect(await w.submit(a)).toBe('pending');
    expect(w.getSnapshot().receipt).toBeNull();
    expect(await w.submit(statusAttempt(detail(), 'Failed', '', 'Other'))).toBe(
      'ignored',
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(await w.submit()).toBe('success');
    const original = request.mock.calls[0]?.[1] as RequestInit;
    const retry = request.mock.calls[1]?.[1] as RequestInit;
    expect(retry.body).toBe(original.body);
    expect(retry.method).toBe(original.method);
    expect(retry.headers).toEqual(original.headers);
    expect(retry.signal).not.toBe(original.signal);
    expect(w.getSnapshot().pending).toBeNull();
  });
  it('retains identical proof files through a 503 and accepts only confirmed delivery', async () => {
    vi.useFakeTimers();
    const request = vi
      .fn()
      .mockResolvedValueOnce(response({ code: 'delivery_unavailable' }, 503))
      .mockResolvedValue(response(raw('Delivered', 6)));
    const w = new CourierWorkflow(new CourierApi(request));
    const photo = new File(['p'], 'p.png', { type: 'image/png' });
    const a = proofAttempt(detail('OutForDelivery', 5), 'Recipient', photo);
    await w.submit(a);
    expect(w.getSnapshot().pending?.photo).toBe(photo);
    expect(w.getSnapshot().receipt).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    await w.submit();
    expect(w.getSnapshot().receipt?.status).toBe('Delivered');
    expect((request.mock.calls[0]?.[1] as RequestInit).headers).toEqual(
      (request.mock.calls[1]?.[1] as RequestInit).headers,
    );
  });
  it.each([
    'stale_version',
    'invalid_transition',
    'idempotency_conflict',
    'key_expired',
  ])('requires reload and a new action after %s', async (code) => {
    const request = vi.fn().mockResolvedValue(response({ code }, 409));
    const w = new CourierWorkflow(new CourierApi(request));
    expect(
      await w.submit(statusAttempt(detail(), 'PickedUp', 'Collected')),
    ).toBe('reload');
    expect(w.getSnapshot().pending).toBeNull();
    expect(await w.submit()).toBe('ignored');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404])(
    'purges and blocks actions on %s',
    async (status) => {
      const w = new CourierWorkflow(
        new CourierApi(vi.fn().mockResolvedValue(response({}, status))),
      );
      expect(
        await w.submit(statusAttempt(detail(), 'PickedUp', 'Collected')),
      ).toBe('denied');
      expect(w.getSnapshot().blocked).toBe(true);
      expect(w.getSnapshot().pending).toBeNull();
    },
  );
  it('prevents double submission and discards a late old-session receipt', async () => {
    let finish!: (r: Response) => void;
    const request = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((r) => {
          finish = r;
        }),
    );
    const w = new CourierWorkflow(new CourierApi(request));
    const a = statusAttempt(detail(), 'PickedUp', 'Collected');
    const pending = w.submit(a);
    expect(await w.submit(a)).toBe('ignored');
    w.dispose();
    finish(response(raw('PickedUp', 3)));
    expect(await pending).toBe('ignored');
    expect(w.getSnapshot().receipt).toBeNull();
    expect(w.getSnapshot().pending).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
