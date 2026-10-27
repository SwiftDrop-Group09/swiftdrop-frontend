export interface SessionSnapshot {
  readonly principalId: string | null;
  readonly roles: readonly string[];
}

export interface Zone {
  readonly id: string;
  readonly name: string;
}

export interface ZoneCatalog {
  load(signal?: AbortSignal): Promise<readonly Zone[]>;
}

/** The IAM adapter owns credentials. Booking never stores or mints tokens. */
export type AuthenticatedRequest = (
  path: string,
  init: RequestInit,
) => Promise<Response>;

export interface Quote {
  readonly quoteId: string;
  readonly total: string;
  readonly currency: string;
  readonly pricingVersion: string;
  readonly expiresAt: string;
  readonly fingerprint: string;
}

export interface BookingReceipt {
  readonly id: string;
  readonly trackingNumber: string;
  readonly status: string;
  readonly version: string;
  readonly priceSnapshot: {
    readonly total: string;
    readonly currency: string;
    readonly pricingVersion: string;
  };
  readonly createdAt: string;
}

export interface PendingAttempt {
  readonly ownerId: string;
  readonly quoteId: string;
  readonly total: string;
  readonly key: string;
  readonly body: string;
}

export interface PendingAttemptStore {
  read(ownerId: string): PendingAttempt | null;
  write(attempt: PendingAttempt): void;
  clear(ownerId: string): void;
}

export interface BookingEnvironment {
  readonly session: SessionSnapshot;
  readonly request: AuthenticatedRequest;
  readonly zones: ZoneCatalog;
  readonly attempts: PendingAttemptStore;
  readonly apiBase?: string;
}

export function memoryAttemptStore(): PendingAttemptStore {
  const attempts = new Map<string, PendingAttempt>();
  return {
    read: (ownerId) => attempts.get(ownerId) ?? null,
    write: (attempt) => attempts.set(attempt.ownerId, Object.freeze(attempt)),
    clear: (ownerId) => {
      attempts.delete(ownerId);
    },
  };
}
