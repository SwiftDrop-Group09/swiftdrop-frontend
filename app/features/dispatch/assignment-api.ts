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

const integerText = z
  .instanceof(JsonNumber)
  .transform((n) => decimalText(n.source));
const version = integerText.refine(
  (s) => /^[1-9]\d*$/.test(s) && BigInt(s) <= 9223372036854775807n,
);
const count = integerText
  .refine((s) => /^\d+$/.test(s) && Number.isSafeInteger(Number(s)))
  .transform(Number);
const candidate = z
  .object({
    courierId: z.uuid(),
    onDuty: z.boolean(),
    activeCountForServiceDate: count,
    capacity: count.refine((n) => n > 0),
  })
  .refine((c) => c.activeCountForServiceDate < c.capacity);
const optionsSchema = z
  .object({
    parcelId: z.uuid(),
    parcelVersion: version,
    businessToday: z.iso.date(),
    operationsTimeZone: z.string().min(1),
    serviceDate: z.iso.date(),
    reassign: z.boolean().default(false),
    currentAssignment: z
      .object({
        courierId: z.uuid(),
        serviceDate: z.iso.date(),
      })
      .nullable()
      .default(null),
    items: z.array(candidate),
    totalCount: count,
    page: count.refine((n) => n >= 1),
    pageSize: count.refine((n) => n >= 1 && n <= 100),
  })
  .refine(
    (p) =>
      p.serviceDate >= p.businessToday &&
      (p.reassign
        ? p.currentAssignment !== null &&
          !p.items.some((c) => c.courierId === p.currentAssignment?.courierId)
        : p.currentAssignment === null) &&
      new Set(p.items.map((c) => c.courierId)).size === p.items.length,
  );
const receiptSchema = z.object({
  id: z.uuid(),
  trackingNumber: z.string().min(1),
  status: z.literal('Assigned'),
  version,
  priceSnapshot: z.object({
    total: integerText.refine(validMoney),
    currency: z.literal('LKR'),
    pricingVersion: z.string().min(1),
  }),
  createdAt: z.iso.datetime({ offset: true }),
});
export type AssignmentOptions = z.infer<typeof optionsSchema>;
export type AssignmentCandidate = AssignmentOptions['items'][number];
export type AssignmentAttempt = Readonly<{
  key: string;
  body: string;
  parcelId: string;
  expectedVersion: string;
}>;
export class AssignmentError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    readonly retryAfter = 1,
  ) {
    super(
      messages[code] ??
        'Assignment could not be confirmed. Retry the same assignment.',
    );
  }
  get uncertain() {
    return (
      this.status === 0 ||
      this.status >= 500 ||
      this.code === 'operation_in_progress' ||
      this.code === 'invalid_response'
    );
  }
}
const messages: Record<string, string> = {
  stale_version:
    'The parcel changed. Reload available couriers before confirming again.',
  invalid_transition:
    'This parcel no longer permits this assignment. Reload the parcel.',
  capacity_exceeded:
    'This courier is full for the selected date. Reload and choose another courier.',
  courier_unavailable:
    'The courier is no longer eligible for this date. Reload available couriers.',
  zone_mismatch:
    'The courier no longer serves this delivery zone. Reload available couriers.',
  not_found: 'The parcel or courier is no longer available. Reload the queue.',
  validation:
    'The date or assignment is no longer valid. Reload and review your selection.',
  idempotency_conflict:
    'This request key belongs to another assignment. Reload and review before starting again.',
  key_expired:
    'This assignment request has expired. Reload and verify the parcel before starting again.',
  forbidden: 'You no longer have permission to assign parcels.',
  unauthorized:
    'Sign in again with the same operations account to verify this assignment.',
  session_changed:
    'Your account changed. The previous account’s assignment cannot be retried here.',
};
async function responseBody(response: Response) {
  const text = await response.text();
  let body: unknown;
  try {
    body = parseExactJson(text);
  } catch {
    throw new AssignmentError(
      response.ok ? 'invalid_response' : 'unexpected',
      response.status,
    );
  }
  if (!response.ok) {
    const problem = z.object({ code: z.string().optional() }).safeParse(body);
    const retry = Number(response.headers.get('Retry-After'));
    throw new AssignmentError(
      problem.success ? (problem.data.code ?? 'unexpected') : 'unexpected',
      response.status,
      Number.isFinite(retry) ? Math.min(Math.max(retry, 1), 300) : 1,
    );
  }
  return body;
}
export async function getAssignmentOptions(
  request: AuthenticatedRequest,
  base: string,
  parcelId: string,
  serviceDate: string | undefined,
  page: number,
  signal?: AbortSignal,
  reassign = false,
) {
  const query = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (serviceDate) query.set('serviceDate', serviceDate);
  if (reassign) query.set('reassign', 'true');
  const response = await request(
    `${base}/v1/deliveries/${encodeURIComponent(parcelId)}/assignment-options?${query}`,
    { signal, cache: 'no-store' },
  );
  const parsed = optionsSchema.safeParse(await responseBody(response));
  if (
    !parsed.success ||
    parsed.data.parcelId !== parcelId ||
    parsed.data.reassign !== reassign ||
    parsed.data.page !== page ||
    parsed.data.pageSize !== 20 ||
    (serviceDate && parsed.data.serviceDate !== serviceDate)
  )
    throw new AssignmentError('invalid_response', response.status);
  return parsed.data;
}
export function assignmentAttempt(
  parcelId: string,
  courierId: string,
  expectedVersion: string,
  serviceDate: string,
  reassignment?: { reason: string },
): AssignmentAttempt {
  if (
    !/^[1-9]\d*$/.test(expectedVersion) ||
    BigInt(expectedVersion) > 9223372036854775807n
  )
    throw new Error('Invalid parcel version.');
  const reason = reassignment?.reason.trim();
  if (reassignment && (!reason || reason.length > 500))
    throw new Error('Supply a reassignment reason of 1 to 500 characters.');
  return Object.freeze({
    parcelId,
    expectedVersion,
    key: crypto.randomUUID(),
    body: stringifyExactJson({
      parcelId,
      courierId,
      expectedVersion: new JsonNumber(expectedVersion),
      reassign: Boolean(reassignment),
      serviceDate,
      ...(reassignment ? { reason } : {}),
    }),
  });
}
export async function submitAssignment(
  request: AuthenticatedRequest,
  base: string,
  attempt: AssignmentAttempt,
  signal?: AbortSignal,
) {
  try {
    const response = await request(`${base}/v1/deliveries/assign`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': attempt.key,
      },
      body: attempt.body,
    });
    const parsed = receiptSchema.safeParse(await responseBody(response));
    if (
      !parsed.success ||
      response.status !== 200 ||
      parsed.data.id !== attempt.parcelId ||
      BigInt(parsed.data.version) !== BigInt(attempt.expectedVersion) + 1n
    )
      throw new AssignmentError('invalid_response', response.status);
    return parsed.data;
  } catch (error) {
    if (error instanceof AssignmentError) throw error;
    if (error instanceof IdentityError)
      throw new AssignmentError(error.code, error.status);
    throw new AssignmentError('network');
  }
}
