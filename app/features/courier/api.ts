import { z } from 'zod';
import type { AuthenticatedRequest } from '~/features/identity/contracts';
import { IdentityError } from '~/features/identity/api';
import {
  JsonNumber,
  decimalText,
  parseExactJson,
  stringifyExactJson,
  validMoney,
} from '~/shared/exact-json';

const numeric = z
  .instanceof(JsonNumber)
  .transform((n) => decimalText(n.source));
const version = numeric.refine(
  (s) => /^[1-9]\d*$/.test(s) && BigInt(s) <= 9223372036854775807n,
);
const count = numeric
  .refine((s) => /^\d+$/.test(s) && Number.isSafeInteger(Number(s)))
  .transform(Number);
export const states = [
  'Created',
  'Assigned',
  'PickedUp',
  'InTransit',
  'OutForDelivery',
  'Delivered',
  'Failed',
  'Cancelled',
] as const;
export const reasons = [
  'RecipientUnavailable',
  'AddressUnreachable',
  'Damaged',
  'Other',
] as const;
export const summarySchema = z.object({
  id: z.uuid(),
  trackingNumber: z.string().min(1),
  status: z.enum(states),
  version,
  priceSnapshot: z.object({
    total: numeric.refine(validMoney),
    currency: z.literal('LKR'),
    pricingVersion: z.string().min(1),
  }),
  createdAt: z.iso.datetime({ offset: true }),
});
const address = z.object({
  street: z.string(),
  city: z.string(),
  postalCode: z.string(),
  zoneId: z.uuid(),
});
const privateFields = {
  pickupAddress: address,
  deliveryAddress: address,
  recipient: z.object({ name: z.string(), phoneNumber: z.string() }),
  packageDetails: z.object({ weightKg: numeric, size: z.string() }),
};
const assigned = summarySchema.extend({
  ...privateFields,
  serviceDate: z.iso.date(),
  isOverdue: z.boolean(),
});
const assignment = z.object({
  status: z.enum(['Active', 'Reassigned', 'Delivered', 'Failed', 'Cancelled']),
  serviceDate: z.iso.date(),
  assignedAt: z.iso.datetime({ offset: true }),
  pickedUpAt: z.iso.datetime({ offset: true }).nullable(),
  deliveredAt: z.iso.datetime({ offset: true }).nullable(),
});
export const detailSchema = summarySchema.extend({
  ...privateFields,
  assignment: assignment.nullable(),
  history: z.array(
    z.object({
      fromStatus: z.enum(states).nullable(),
      toStatus: z.enum(states),
      changeReason: z.string().nullable(),
      deliveryNote: z.string().nullable(),
      timestamp: z.iso.datetime({ offset: true }),
    }),
  ),
});
const page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    totalCount: count,
    page: count.refine((n) => n >= 1),
    pageSize: count.refine((n) => n >= 1 && n <= 100),
  });
export type Summary = z.infer<typeof summarySchema>;
export type Detail = z.infer<typeof detailSchema>;
export type Assigned = z.infer<typeof assigned>;
export type Page<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};
export type Reason = (typeof reasons)[number];
export const nextStage: Partial<Record<Summary['status'], Summary['status']>> =
  { Assigned: 'PickedUp', PickedUp: 'InTransit', InTransit: 'OutForDelivery' };
export const active = (d: Summary) =>
  ['Assigned', 'PickedUp', 'InTransit', 'OutForDelivery'].includes(d.status);
export class CourierError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    readonly retryAfter = 1,
  ) {
    super(
      messages[code] ??
        'The request could not be completed. Reload and try again.',
    );
  }
  get uncertain() {
    return (
      this.status === 0 ||
      this.status >= 500 ||
      this.code === 'operation_in_progress'
    );
  }
}
const messages: Record<string, string> = {
  invalid_response:
    'Delivery returned an unconfirmed response. Retry the original request.',
  stale_version:
    'This parcel changed. Reloading its current state; choose a new action.',
  invalid_transition:
    'This action is no longer valid. Reloading current state; choose a new action.',
  unauthorized: 'Sign in again to continue.',
  forbidden: 'A Courier account is required.',
  not_found: 'This parcel is no longer available to your account.',
  validation_error: 'Check the required fields and supported proof files.',
  idempotency_conflict:
    'This request conflicts with an earlier request. Reload the parcel before choosing another action.',
  key_expired:
    'This retained request has expired. Reload the parcel before choosing another action.',
  operation_in_progress:
    'The original request is still processing. Retry the same request shortly.',
  delivery_unavailable:
    'Delivery is temporarily unavailable. The outcome may be unknown. Retry the original request.',
  network:
    'The connection was interrupted. The outcome may be unknown. Retry the original request.',
};
export type Attempt = Readonly<{
  id: string;
  version: string;
  status: Summary['status'];
  key: string;
  body?: string;
  recipientName?: string;
  photo?: File;
  signature?: File;
}>;
export function statusAttempt(
  d: Detail,
  status: Summary['status'],
  notes: string,
  failureReason?: Reason,
): Attempt {
  if (
    !active(d) ||
    (status === 'Failed'
      ? !reasons.includes(failureReason!)
      : nextStage[d.status] !== status)
  )
    throw new CourierError('validation_error', 400);
  if (notes.length > 500 || (status !== 'Failed' && !notes.trim()))
    throw new CourierError('validation_error', 400);
  return Object.freeze({
    id: d.id,
    version: d.version,
    status,
    key: crypto.randomUUID(),
    body: stringifyExactJson({
      status,
      expectedVersion: new JsonNumber(d.version),
      notes: notes.trim() || null,
      ...(status === 'Failed' ? { failureReason: failureReason! } : {}),
    }),
  });
}
export function proofAttempt(
  d: Detail,
  recipientName: string,
  photo?: File,
  signature?: File,
): Attempt {
  if (
    d.status !== 'OutForDelivery' ||
    !recipientName.trim() ||
    recipientName.length > 120 ||
    (!photo && !signature)
  )
    throw new CourierError('validation_error', 400);
  for (const f of [photo, signature])
    if (
      f &&
      (!['image/jpeg', 'image/png'].includes(f.type) ||
        f.size === 0 ||
        f.size > 5 * 1024 * 1024)
    )
      throw new CourierError('validation_error', 400);
  return Object.freeze({
    id: d.id,
    version: d.version,
    status: 'Delivered',
    key: crypto.randomUUID(),
    recipientName: recipientName.trim(),
    photo,
    signature,
  });
}
export class CourierApi {
  constructor(
    private readonly request: AuthenticatedRequest,
    private readonly base = '/api',
  ) {}
  private async read<T>(
    path: string,
    schema: z.ZodType<T>,
    init?: RequestInit,
  ): Promise<T> {
    let r: Response;
    try {
      r = await this.request(`${this.base.replace(/\/$/, '')}/v1${path}`, {
        signal: AbortSignal.timeout(init?.method === 'POST' ? 120_000 : 20_000),
        ...init,
      });
    } catch (e) {
      if (e instanceof IdentityError) {
        if (e.status === 403 || e.code === 'forbidden')
          throw new CourierError('forbidden', 403);
        if (e.status === 401 || e.code === 'session_changed')
          throw new CourierError('unauthorized', 401);
      }
      throw new CourierError('network');
    }
    if (r.status >= 200 && r.status < 400 && r.status !== 200)
      throw new CourierError('invalid_response');
    if (!r.ok) {
      let code =
        r.status === 401
          ? 'unauthorized'
          : r.status === 403
            ? 'forbidden'
            : r.status === 404
              ? 'not_found'
              : 'delivery_unavailable';
      try {
        const b: unknown = JSON.parse(await r.text());
        if (
          b &&
          typeof b === 'object' &&
          'code' in b &&
          typeof b.code === 'string'
        )
          code = b.code;
      } catch {
        /* Safe fallback. */
      }
      throw new CourierError(
        code,
        r.status,
        Math.min(60, Math.max(1, Number(r.headers.get('Retry-After')) || 1)),
      );
    }
    try {
      return schema.parse(parseExactJson(await r.text()));
    } catch {
      throw new CourierError('invalid_response', 0);
    }
  }
  manifest(date = '', includeOverdue = true, p = 1) {
    const q = new URLSearchParams({
      includeOverdue: String(includeOverdue),
      page: String(p),
      pageSize: '20',
    });
    if (date) q.set('date', date);
    return this.read(`/couriers/me/assignments?${q}`, page(assigned));
  }
  history(p = 1) {
    return this.read(
      `/couriers/me/history?page=${p}&pageSize=20`,
      page(summarySchema),
    );
  }
  detail(id: string) {
    if (!z.uuid().safeParse(id).success)
      return Promise.reject(new CourierError('not_found', 404));
    return this.read(`/parcels/${id}`, detailSchema);
  }
  async submit(a: Attempt): Promise<Summary> {
    const headers: Record<string, string> = { 'Idempotency-Key': a.key };
    let body: BodyInit;
    if (a.body) {
      headers['Content-Type'] = 'application/json';
      body = a.body;
    } else {
      const f = new FormData();
      f.set('expectedVersion', a.version);
      f.set('recipientName', a.recipientName!);
      if (a.photo)
        f.set(
          'photo',
          a.photo,
          'photo' + (a.photo.type === 'image/png' ? '.png' : '.jpg'),
        );
      if (a.signature) f.set('signature', a.signature, 'signature.png');
      body = f;
    }
    const result = await this.read(
      `/deliveries/${a.id}/${a.body ? 'status' : 'pod'}`,
      summarySchema,
      { method: a.body ? 'PUT' : 'POST', headers, body },
    );
    if (
      result.id !== a.id ||
      result.status !== a.status ||
      BigInt(result.version) !== BigInt(a.version) + 1n
    )
      throw new CourierError('invalid_response');
    return result;
  }
}
