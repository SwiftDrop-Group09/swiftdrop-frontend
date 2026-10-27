import type {
  AuthenticatedRequest,
  BookingReceipt,
  PendingAttempt,
  Quote,
} from './contracts';
import {
  decimalText,
  JsonNumber,
  parseExactJson,
  stringifyExactJson,
  validMoney,
} from './exact-json';
import type { JsonValue } from './exact-json';
import { isUuid } from './validation';
import type { BookingFormValues } from './validation';

export class BookingApiError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
    readonly retryAfterSeconds = 0,
    readonly fieldErrors: Readonly<Record<string, readonly string[]>> = {},
  ) {
    super('The booking request could not be completed.');
  }
}

function object(value: JsonValue): { [key: string]: JsonValue } {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value instanceof JsonNumber
  ) {
    throw new Error('Expected an object.');
  }
  return value;
}

function fields(value: JsonValue, keys: readonly string[]) {
  const result = object(value);
  if (
    Object.keys(result).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(result, key))
  ) {
    throw new Error('Unexpected response fields.');
  }
  return result;
}

function text(value: JsonValue | undefined): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error('Expected text.');
  return value;
}

function money(value: JsonValue | undefined): string {
  if (!(value instanceof JsonNumber) || !validMoney(value.source))
    throw new Error('Expected exact money.');
  return value.source;
}

function id(value: JsonValue | undefined): string {
  const result = text(value);
  if (!isUuid(result)) throw new Error('Expected identifier.');
  return result;
}

function instant(value: JsonValue | undefined): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result)))
    throw new Error('Expected timestamp.');
  return result;
}

function parseQuote(body: string): Quote {
  const value = fields(parseExactJson(body), [
    'quoteId',
    'total',
    'currency',
    'pricingVersion',
    'expiresAt',
    'fingerprint',
  ]);
  const currency = text(value.currency);
  if (currency !== 'LKR') throw new Error('Unsupported currency.');
  return {
    quoteId: id(value.quoteId),
    total: money(value.total),
    currency,
    pricingVersion: text(value.pricingVersion),
    expiresAt: instant(value.expiresAt),
    fingerprint: text(value.fingerprint),
  };
}

function parseReceipt(body: string, attempt: PendingAttempt): BookingReceipt {
  const value = fields(parseExactJson(body), [
    'id',
    'trackingNumber',
    'status',
    'version',
    'priceSnapshot',
    'createdAt',
  ]);
  const snapshot = fields(value.priceSnapshot!, [
    'total',
    'currency',
    'pricingVersion',
  ]);
  const total = money(snapshot.total);
  if (
    text(value.status) !== 'Created' ||
    !(value.version instanceof JsonNumber) ||
    decimalText(value.version.source) !== '1' ||
    decimalText(total) !== decimalText(attempt.total) ||
    text(snapshot.currency) !== 'LKR'
  ) {
    throw new Error('Unexpected committed response.');
  }
  return {
    id: id(value.id),
    trackingNumber: text(value.trackingNumber),
    status: 'Created',
    version: value.version.source,
    priceSnapshot: {
      total,
      currency: 'LKR',
      pricingVersion: text(snapshot.pricingVersion),
    },
    createdAt: instant(value.createdAt),
  };
}

async function failure(response: Response): Promise<BookingApiError> {
  let code = 'unexpected_response';
  const fieldErrors: Record<string, string[]> = {};
  try {
    const problem = object(parseExactJson(await response.text()));
    if (typeof problem.code === 'string') code = problem.code;
    if (problem.errors) {
      for (const [field, messages] of Object.entries(object(problem.errors))) {
        if (
          Array.isArray(messages) &&
          messages.every((item) => typeof item === 'string')
        ) {
          fieldErrors[field] = messages;
        }
      }
    }
  } catch {
    // Never expose raw private responses, parser errors or transport exceptions.
  }
  const retry = Number(response.headers.get('Retry-After'));
  return new BookingApiError(
    code,
    response.status,
    Number.isFinite(retry) ? Math.min(Math.max(retry, 0), 300) : 0,
    fieldErrors,
  );
}

export function confirmationBody(quoteId: string, total: string): string {
  if (!isUuid(quoteId) || !validMoney(total))
    throw new Error('Invalid confirmation.');
  return stringifyExactJson({ quoteId, acceptTotal: new JsonNumber(total) });
}

export function validPendingAttempt(
  value: unknown,
  ownerId: string,
): value is PendingAttempt {
  try {
    if (!value || typeof value !== 'object') return false;
    const attempt = value as Partial<PendingAttempt>;
    return (
      attempt.ownerId === ownerId &&
      isUuid(ownerId) &&
      typeof attempt.quoteId === 'string' &&
      isUuid(attempt.quoteId) &&
      typeof attempt.total === 'string' &&
      validMoney(attempt.total) &&
      typeof attempt.key === 'string' &&
      !!attempt.key.trim() &&
      attempt.key.length <= 128 &&
      !Array.from(attempt.key).some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || (code >= 127 && code <= 159);
      }) &&
      attempt.body === confirmationBody(attempt.quoteId, attempt.total)
    );
  } catch {
    return false;
  }
}

export class CustomerBookingApi {
  constructor(
    private readonly request: AuthenticatedRequest,
    private readonly base = '/api',
  ) {}

  async estimate(input: BookingFormValues): Promise<Quote> {
    const address = (prefix: 'pickup' | 'delivery') => ({
      street: input[`${prefix}Street`],
      city: input[`${prefix}City`],
      postalCode: input[`${prefix}PostalCode`],
      zoneId: input[`${prefix}ZoneId`],
    });
    const body = stringifyExactJson({
      pickupAddress: address('pickup'),
      deliveryAddress: address('delivery'),
      packageDetails: {
        weightKg: new JsonNumber(input.weightKg),
        size: input.size,
      },
      recipient: {
        name: input.recipientName,
        phoneNumber: input.recipientPhone,
      },
    });
    const response = await this.send('/v1/quotes', body);
    if (response.status !== 200) throw await failure(response);
    try {
      return parseQuote(await response.text());
    } catch {
      throw new BookingApiError('unreadable_response', 200);
    }
  }

  async confirm(attempt: PendingAttempt): Promise<BookingReceipt> {
    const response = await this.send('/v1/parcels', attempt.body, attempt.key);
    if (response.status !== 201) throw await failure(response);
    try {
      return parseReceipt(await response.text(), attempt);
    } catch {
      throw new BookingApiError('unreadable_response', 201);
    }
  }

  private async send(
    path: string,
    body: string,
    key?: string,
  ): Promise<Response> {
    try {
      return await this.request(this.base.replace(/\/$/, '') + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        body,
      });
    } catch {
      throw new BookingApiError('network_error');
    }
  }
}
