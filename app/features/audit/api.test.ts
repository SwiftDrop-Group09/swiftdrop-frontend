import { describe, expect, it, vi } from 'vitest';
import type { IdentitySession } from '~/features/identity/session';
import { emptyFilters, readAudit, validateFilters, type Activity } from './api';

export function record(
  service: Activity['service'],
  digit: string,
  timestamp: string,
): Activity {
  return {
    id: `00000000-0000-4000-8000-00000000000${digit}`,
    timestamp,
    service,
    actorId: '00000000-0000-4000-8000-000000000009',
    roles: ['Admin'],
    actorType: 'Human',
    action: 'RolesChanged',
    method: 'PUT',
    route: '/api/v1/users/{id}/roles',
    resourceId: null,
    ipAddress: '192.0.2.7',
    ipSource: 'Peer',
    statusCode: 200,
    outcome: 'Success',
    correlationId: null,
    durationMs: 12,
    kind: 'Request',
  };
}
function session(fetcher: typeof fetch) {
  return {
    api: { base: '/api' },
    authenticatedRequest: fetcher,
  } as unknown as IdentitySession;
}
const page = (items: Activity[], hasMore = false, recordingEnabled = true) =>
  new Response(
    JSON.stringify({
      items,
      totalCount: items.length,
      hasMore,
      recordingEnabled,
    }),
    { headers: { 'content-type': 'application/json' } },
  );

function urlOf(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

describe('Cross-service audit reads', () => {
  it('merges time-ordered rows and advances only cursors actually consumed', async () => {
    const identity = record('Identity', '1', '2026-11-13T10:00:01.000000Z');
    const delivery = record('Delivery', '2', '2026-11-13T10:00:02.000000Z');
    const request = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        page(
          urlOf(input).includes('/delivery/')
            ? [delivery]
            : urlOf(input).includes('/merchant/')
              ? []
              : [identity],
        ),
      ),
    );
    const result = await readAudit(
      session(request),
      emptyFilters,
      {},
      '2026-11-14T00:00:00Z',
      1,
    );
    expect(result.items).toEqual([delivery]);
    expect(result.hasMore).toBe(true);
    expect(result.next.Delivery).toEqual({
      before: delivery.timestamp,
      beforeId: delivery.id,
    });
    expect(result.next.Identity).toBeUndefined();
  });
  it('passes exact filters and scoped cursor to the configured authenticated transport', async () => {
    const request = vi.fn<typeof fetch>(() => Promise.resolve(page([])));
    await readAudit(
      session(request),
      {
        ...emptyFilters,
        service: 'Identity',
        ip: '2001:db8::7',
        action: 'RolesChanged',
        actorType: 'Human',
      },
      {
        Identity: {
          before: '2026-11-13T10:00:00Z',
          beforeId: '00000000-0000-4000-8000-000000000001',
        },
      },
      '2026-11-14T00:00:00Z',
      20,
    );
    expect(request).toHaveBeenCalledTimes(1);
    const url = new URL(
      urlOf(request.mock.calls[0]![0]),
      'https://example.test',
    );
    expect(url.pathname).toBe('/api/v1/audit-logs/activity');
    expect(url.searchParams.get('ip')).toBe('2001:db8::7');
    expect(url.searchParams.get('actorType')).toBe('Human');
    expect(url.searchParams.get('beforeId')).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
  });
  it('rejects incomplete coverage and malformed responses without exposing their body', async () => {
    const request = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        urlOf(input).includes('/delivery/')
          ? new Response('private backend details', { status: 503 })
          : page([]),
      ),
    );
    await expect(
      readAudit(session(request), emptyFilters, {}, '2026-11-14T00:00:00Z', 20),
    ).rejects.toThrow('Delivery could not be loaded');
    request.mockResolvedValue(new Response('private backend details'));
    await expect(
      readAudit(session(request), emptyFilters, {}, '2026-11-14T00:00:00Z', 20),
    ).rejects.toThrow('could not be verified');
  });
  it('reports disabled recording and validates UUID/IP input', async () => {
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(page([], false, false)),
    );
    const result = await readAudit(
      session(request),
      { ...emptyFilters, service: 'Identity' },
      {},
      '2026-11-14T00:00:00Z',
      20,
    );
    expect(result.disabledSources).toEqual(['Identity']);
    expect(validateFilters({ ...emptyFilters, actorId: 'bad' })).toContain(
      'UUID',
    );
    expect(validateFilters({ ...emptyFilters, ip: 'bad' })).toContain('IPv4');
    expect(validateFilters({ ...emptyFilters, ip: '2001:db8::1' })).toBe('');
  });
});
