import { validPendingAttempt } from '../app/features/customer-booking/api';
import type { PendingAttemptStore } from '../app/features/customer-booking/contracts';

/** Test entry only. Stores no credentials, recipient or address information. */
export function tabAttemptStore(storage: Storage): PendingAttemptStore {
  const key = 'swiftdrop.booking-test.pending';
  return {
    read(ownerId) {
      const raw = storage.getItem(key);
      if (!raw) return null;
      try {
        const value: unknown = JSON.parse(raw);
        if (validPendingAttempt(value, ownerId)) return Object.freeze(value);
      } catch {
        // A corrupted record must not become a different booking request.
      }
      storage.removeItem(key);
      return null;
    },
    write(attempt) {
      if (!validPendingAttempt(attempt, attempt.ownerId))
        throw new Error('Invalid pending attempt.');
      storage.setItem(key, JSON.stringify(attempt));
    },
    clear(ownerId) {
      const raw = storage.getItem(key);
      if (!raw) return;
      try {
        const value: unknown = JSON.parse(raw);
        if (validPendingAttempt(value, ownerId)) storage.removeItem(key);
      } catch {
        storage.removeItem(key);
      }
    },
  };
}
