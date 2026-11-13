import { describe, expect, it, vi } from 'vitest';
import type { IdentitySession } from '~/features/identity/session';
import {
  emptyFilters,
  readAudit,
  readActorNames,
  actorLabel,
  validateFilters,
  type Activity,
} from './api';

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
  it('accepts PostgreSQL GUIDs derived from historical event hashes', async () => {
    const historical = {
      ...record('Identity', '1', '2026-11-13T10:00:01.000000Z'),
      id: 'e1234567-89ab-cdef-0123-456789abcdef',
      kind: 'Security' as const,
    };
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(page([historical])),
    );
    const result = await readAudit(
      session(request),
      { ...emptyFilters, service: 'Identity' },
      {},
      '2026-11-14T00:00:00Z',
      20,
    );
    expect(result.items).toEqual([historical]);
    expect(
      validateFilters({ ...emptyFilters, resourceId: historical.id }),
    ).toBe('');
    expect(
      validateFilters({ ...emptyFilters, resourceId: 'invalid' }),
    ).not.toBe('');
  });
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
  it('excludes services and sends negative filters to every remaining service', async () => {
    const request = vi.fn<typeof fetch>(() => Promise.resolve(page([])));
    await readAudit(
      session(request),
      { ...emptyFilters, notService: 'Identity', notOutcome: 'Success' },
      {},
      '2026-11-14T00:00:00Z',
      20,
    );
    expect(request).toHaveBeenCalledTimes(2);
    for (const [input] of request.mock.calls) {
      const url = new URL(urlOf(input), 'https://example.test');
      expect(url.searchParams.get('notOutcome')).toBe('Success');
      expect(url.searchParams.has('notService')).toBe(false);
      expect(url.pathname).not.toContain('/audit-logs/activity');
    }
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

describe('Audit actor labels', () => {
  it('resolves visible actors through every needed directory page', async () => {
    const item = record('Identity', '1', '2026-11-13T10:00:00Z');
    const request = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: urlOf(input).includes('page=1&')
              ? [
                  {
                    id: '00000000-0000-4000-8000-000000000008',
                    fullName: 'Another account',
                    email: 'another@example.test',
                  },
                ]
              : [
                  {
                    id: item.actorId,
                    fullName: 'Nimal Perera',
                    email: 'nimal@example.test',
                  },
                ],
            totalCount: 101,
          }),
        ),
      ),
    );
    const names = await readActorNames(session(request), [item.actorId!]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(actorLabel(item, names)).toBe('Nimal Perera');
    expect(actorLabel(item, {})).toBe('Unknown or deleted account');
    expect(actorLabel(item, undefined, false, true)).toBe(
      'Actor name unavailable',
    );
    expect(
      actorLabel({ ...item, actorId: null, actorType: 'Anonymous' }, {}),
    ).toBe('Unauthenticated visitor');
    expect(
      actorLabel({ ...item, actorId: null, actorType: 'System' }, {}),
    ).toBe('System automation');
  });
  it('does not request users for an empty actor list or hide directory failures', async () => {
    const request = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    );
    expect(await readActorNames(session(request), [])).toEqual({});
    expect(request).not.toHaveBeenCalled();
    await expect(
      readActorNames(session(request), [
        '00000000-0000-4000-8000-000000000009',
      ]),
    ).rejects.toThrow('Actor names could not be loaded.');
  });
});
