import type { DashboardDays } from './contracts';

/** The API accepts at most 366 days between `from` and `to` (exclusive). */
export const MAX_RANGE_DAYS = 366;

const DAY_MS = 86_400_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-11-13" for the UTC calendar day of `now`. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function parseDay(day: string): number | null {
  if (!DAY_PATTERN.test(day)) return null;
  const time = Date.parse(`${day}T00:00:00Z`);
  // Rejects impossible dates such as 2026-02-31, which Date would roll over.
  return Number.isNaN(time) || utcDay(new Date(time)) !== day ? null : time;
}

function addDays(day: string, days: number): string {
  return utcDay(new Date(parseDay(day)! + days * DAY_MS));
}

export const rangePresets = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
] as const;

/** A preset ending today (UTC), counting today as one of its days. */
export function presetRange(days: number, now: Date): DashboardDays {
  const today = utcDay(now);
  return { fromDay: addDays(today, -(days - 1)), toDay: today };
}

/** Error text for a picked range, or '' when the API will accept it. */
export function validateDays({ fromDay, toDay }: DashboardDays): string {
  const from = parseDay(fromDay);
  const to = parseDay(toDay);
  if (from === null || to === null) return 'Choose a valid start and end date.';
  if (to < from) return 'The end date must be on or after the start date.';
  if ((to - from) / DAY_MS + 1 > MAX_RANGE_DAYS) {
    return `Choose a range of at most ${MAX_RANGE_DAYS} days.`;
  }
  return '';
}

/** Reads ?from=&to= (inclusive UTC days); anything invalid falls back to today. */
export function readDays(params: URLSearchParams, now: Date): DashboardDays {
  const days = {
    fromDay: params.get('from') ?? '',
    toDay: params.get('to') ?? '',
  };
  return validateDays(days) ? presetRange(1, now) : days;
}

/** Inclusive UTC days → the API's [from, to) timestamps. */
export function toApiRange({ fromDay, toDay }: DashboardDays): {
  from: string;
  to: string;
} {
  return {
    from: `${fromDay}T00:00:00Z`,
    to: `${addDays(toDay, 1)}T00:00:00Z`,
  };
}

export function sameDays(a: DashboardDays, b: DashboardDays): boolean {
  return a.fromDay === b.fromDay && a.toDay === b.toDay;
}
