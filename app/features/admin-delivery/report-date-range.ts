const millisecondsPerDay = 24 * 60 * 60 * 1000;

export const maxDeliveryReportDays = 366;

function parseUtcDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

export function getUtcIsoRange(
  startDate: string,
  endDate: string,
): { fromUtc?: string; toUtc?: string; isValid: boolean } {
  const from = parseUtcDate(startDate);
  const lastDay = parseUtcDate(endDate);
  if (!from || !lastDay || lastDay < from) return { isValid: false };

  const to = new Date(lastDay.getTime() + millisecondsPerDay);
  const dayCount = (to.getTime() - from.getTime()) / millisecondsPerDay;

  return {
    fromUtc: from.toISOString(),
    toUtc: to.toISOString(),
    isValid: dayCount <= maxDeliveryReportDays,
  };
}

export function getUtcDatePreset(days: number, now = new Date()) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
