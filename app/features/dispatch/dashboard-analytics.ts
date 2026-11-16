import type { ZoneSummaryResponse } from '~/features/admin-delivery/contracts';

// These are current parcel states, not transitions during a reporting period.
const inProgressStatuses = [
  'Assigned',
  'PickedUp',
  'InTransit',
  'OutForDelivery',
];

export function dispatchSnapshot(zones: ZoneSummaryResponse['zones']) {
  const workloads = zones
    .map((zone) => ({
      zoneId: zone.zoneId,
      name: zone.name,
      awaiting: zone.statusCounts.Created ?? 0,
      active: inProgressStatuses.reduce(
        (sum, status) => sum + (zone.statusCounts[status] ?? 0),
        0,
      ),
    }))
    .sort(
      (a, b) =>
        b.active + b.awaiting - (a.active + a.awaiting) ||
        a.name.localeCompare(b.name) ||
        a.zoneId.localeCompare(b.zoneId),
    );
  return {
    workloads,
    inProgress: workloads.reduce((sum, zone) => sum + zone.active, 0),
    outForDelivery: zones.reduce(
      (sum, zone) => sum + (zone.statusCounts.OutForDelivery ?? 0),
      0,
    ),
    zonesWithBacklog: workloads.filter((zone) => zone.awaiting > 0).length,
  };
}
