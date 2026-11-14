import type { ZoneSummaryResponse } from '~/features/admin-delivery/contracts';

export function metricComparison(
  current: number,
  previous: number,
  rate = false,
) {
  const difference = current - previous;
  if (!difference) return { label: 'No change', direction: 0 };
  if (!rate && previous === 0) return { label: 'New activity', direction: 1 };
  const change = rate ? difference * 100 : (difference / previous) * 100;
  const rounded = Number(change.toFixed(1));
  if (!rounded) return { label: 'No change', direction: 0 };
  return {
    label: `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}${rate ? ' pp' : '%'}`,
    direction: Math.sign(rounded),
  };
}

export function zoneWorkloads(zones: ZoneSummaryResponse['zones']) {
  return zones
    .map((zone) => ({
      zoneId: zone.zoneId,
      name: zone.name,
      active: ['Assigned', 'PickedUp', 'InTransit', 'OutForDelivery'].reduce(
        (sum, status) => sum + (zone.statusCounts[status] ?? 0),
        0,
      ),
      awaiting: zone.statusCounts.Created ?? 0,
    }))
    .sort(
      (a, b) =>
        b.active + b.awaiting - (a.active + a.awaiting) ||
        a.name.localeCompare(b.name) ||
        a.zoneId.localeCompare(b.zoneId),
    );
}
