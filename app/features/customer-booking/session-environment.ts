import { z } from 'zod';
import type { IdentitySession } from '~/features/identity/session';
import { BookingApiError } from './api';
import {
  memoryAttemptStore,
  type BookingEnvironment,
  type PendingAttemptStore,
} from './contracts';

const zonesSchema = z.array(
  z.object({ id: z.uuid(), name: z.string().min(1) }),
);
const stores = new WeakMap<IdentitySession, PendingAttemptStore>();

function attemptsFor(session: IdentitySession) {
  const existing = stores.get(session);
  if (existing) return existing;
  const attempts = memoryAttemptStore();
  let previous = session.getSnapshot().user;
  session.subscribe(() => {
    const next = session.getSnapshot().user;
    if (
      previous &&
      (!next ||
        previous.id !== next.id ||
        previous.roles.toSorted().join() !== next.roles.toSorted().join())
    ) {
      attempts.clear(previous.id);
    }
    previous = next;
  });
  // The session and its listener are collectable together. No credential or
  // unresolved booking is persisted across browser/provider lifetimes.
  stores.set(session, attempts);
  return attempts;
}

export function bookingEnvironmentFor(
  session: IdentitySession,
): BookingEnvironment {
  const user = session.getSnapshot().user;
  return {
    session: { principalId: user?.id ?? null, roles: user?.roles ?? [] },
    request: session.authenticatedRequest,
    apiBase: session.api.base,
    attempts: attemptsFor(session),
    zones: {
      load: async (signal) => {
        const response = await session.authenticatedRequest(
          `${session.api.base}/v1/quotes/zones`,
          { signal, cache: 'no-store' },
        );
        if (!response.ok)
          throw new BookingApiError('zones_unavailable', response.status);
        const parsed = zonesSchema.safeParse(await response.json());
        if (!parsed.success) throw new BookingApiError('zones_unavailable');
        return parsed.data;
      },
    },
  };
}
