import { z } from 'zod';
import type { IdentitySession } from '~/features/identity/session';

export const services = ['Identity', 'Delivery', 'Merchant'] as const;
export type AuditService = (typeof services)[number];
class AuditReadError extends Error {}
export const activitySchema = z.object({
  id: z.guid(),
  timestamp: z.iso.datetime(),
  actorId: z.guid().nullable(),
  roles: z.array(z.string()),
  actorType: z.enum(['Human', 'Service', 'Anonymous', 'System']),
  service: z.enum(services),
  action: z.string(),
  method: z.string(),
  route: z.string(),
  resourceId: z.guid().nullable(),
  ipAddress: z.string().nullable(),
  ipSource: z.string(),
  statusCode: z.number().int().nullable(),
  outcome: z.enum(['Success', 'Denied', 'Failed', 'InProgress']),
  correlationId: z.guid().nullable(),
  durationMs: z.number().nullable(),
  kind: z.enum([
    'Request',
    'Security',
    'Domain',
    'Configuration',
    'Background',
  ]),
});
export type Activity = z.infer<typeof activitySchema>;
type AuditBaseFilters = Record<
  | 'service'
  | 'from'
  | 'to'
  | 'actorId'
  | 'role'
  | 'actorType'
  | 'ip'
  | 'action'
  | 'method'
  | 'outcome'
  | 'resourceId'
  | 'correlationId'
  | 'kind',
  string
>;
export type AuditFilters = AuditBaseFilters &
  Partial<
    Record<
      `not${Capitalize<Exclude<keyof AuditBaseFilters, 'from' | 'to'>>}`,
      string
    >
  >;
export const emptyFilters: AuditFilters = {
  service: '',
  from: '',
  to: '',
  actorId: '',
  role: '',
  actorType: '',
  ip: '',
  action: '',
  method: '',
  outcome: '',
  resourceId: '',
  correlationId: '',
  kind: '',
};
export function validateFilters(filters: AuditFilters) {
  for (const [key, label] of [
    ['actorId', 'Actor ID'],
    ['resourceId', 'Resource ID'],
    ['correlationId', 'Correlation ID'],
  ] as const)
    if (filters[key] && !z.guid().safeParse(filters[key]).success)
      return `${label} must be a valid UUID.`;
  if (
    filters.ip &&
    !z.ipv4().safeParse(filters.ip).success &&
    !z.ipv6().safeParse(filters.ip).success
  )
    return 'Enter a valid IPv4 or IPv6 address.';
  return '';
}
export type Cursors = Partial<
  Record<AuditService, { before: string; beforeId: string }>
>;
const paths: Record<AuditService, string> = {
  Identity: '/v1/audit-logs/activity',
  Delivery: '/v1/delivery/audit-logs',
  Merchant: '/v1/merchant/audit-logs',
};
const pageSchema = z.object({
  items: z.array(activitySchema),
  totalCount: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  recordingEnabled: z.boolean(),
});

export async function readAudit(
  session: IdentitySession,
  filters: AuditFilters,
  cursors: Cursors,
  snapshot: string,
  pageSize: number,
  signal?: AbortSignal,
) {
  if (
    filters.from &&
    filters.to &&
    new Date(filters.from) >= new Date(filters.to)
  )
    throw new Error('The end of the time range must be after its start.');
  const selected = services.filter(
    (service) =>
      (!filters.service || filters.service === service) &&
      filters.notService !== service,
  );
  if (!selected.length) throw new Error('Choose a valid audit service.');
  const results = await Promise.allSettled(
    selected.map(async (service) => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        to: filters.to || snapshot,
      });
      for (const [key, value] of Object.entries(filters))
        if (value && key !== 'service' && key !== 'notService')
          params.set(key, value);
      const cursor = cursors[service];
      if (cursor) {
        params.set('before', cursor.before);
        params.set('beforeId', cursor.beforeId);
      }
      const response = await session
        .authenticatedRequest(
          `${session.api.base}${paths[service]}?${params}`,
          { signal },
        )
        .catch(() => {
          throw new AuditReadError(
            `Audit records from ${service} could not be loaded.`,
          );
        });
      if (!response.ok)
        throw new AuditReadError(
          response.status === 400
            ? 'Check the audit filters and try again.'
            : `Audit records from ${service} could not be loaded.`,
        );
      const parsed = pageSchema.safeParse(
        await response.json().catch(() => null),
      );
      if (
        !parsed.success ||
        parsed.data.items.some((item) => item.service !== service)
      )
        throw new AuditReadError(
          `Audit records from ${service} could not be verified.`,
        );
      return { ...parsed.data, service };
    }),
  );
  const failed = results.find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected')
    throw new Error(
      failed.reason instanceof AuditReadError
        ? failed.reason.message
        : 'Audit records could not be loaded.',
    );
  const pages = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const merged = pages
    .flatMap((page) => page.items)
    .sort(
      (a, b) =>
        b.timestamp.localeCompare(a.timestamp) ||
        b.id.localeCompare(a.id) ||
        b.service.localeCompare(a.service),
    );
  const items = merged.slice(0, pageSize);
  const next: Cursors = { ...cursors };
  for (const item of items)
    next[item.service] = { before: item.timestamp, beforeId: item.id };
  return {
    items,
    next,
    totalCount: pages.reduce((sum, page) => sum + page.totalCount, 0),
    hasMore: merged.length > pageSize || pages.some((page) => page.hasMore),
    disabledSources: pages
      .filter((page) => !page.recordingEnabled)
      .map((page) => page.service),
  };
}

// Resolve only actors on the visible page through the Admin-only user directory.
// Never join service databases or replace the immutable recorded actor ID.
export async function readActorNames(
  session: IdentitySession,
  ids: string[],
  signal?: AbortSignal,
) {
  const pending = new Set(ids);
  const names: Record<string, string> = {};
  const directoryPage = z.object({
    items: z.array(
      z.object({ id: z.guid(), fullName: z.string(), email: z.string() }),
    ),
    totalCount: z.number().int().nonnegative(),
  });
  let page = 1;
  while (pending.size) {
    const response = await session.authenticatedRequest(
      `${session.api.base}/v1/users?page=${page}&pageSize=100`,
      { signal },
    );
    if (!response.ok) throw new Error('Actor names could not be loaded.');
    const result = directoryPage.parse(await response.json());
    for (const actor of result.items) {
      if (!pending.has(actor.id)) continue;
      names[actor.id] = actor.fullName.trim() || actor.email;
      pending.delete(actor.id);
    }
    if (!result.items.length || page * 100 >= result.totalCount) break;
    page++;
  }
  return names;
}

export function actorLabel(
  item: Activity,
  names: Record<string, string> | undefined,
  loading = false,
  failed = false,
) {
  if (!item.actorId)
    return item.actorType === 'Anonymous'
      ? 'Unauthenticated visitor'
      : item.actorType === 'System'
        ? 'System automation'
        : item.actorType === 'Service'
          ? 'Service account'
          : 'Actor not recorded';
  if (names?.[item.actorId]) return names[item.actorId];
  if (loading) return 'Loading actor?';
  if (failed) return 'Actor name unavailable';
  return item.actorType === 'Service'
    ? 'Service account'
    : 'Unknown or deleted account';
}
