import type { ZoneSummaryResponse } from '~/features/admin-delivery/contracts';
import { buildZoneMatrix } from './zone-matrix-model';
import { zoneStatusGroupCounts } from './zone-status-groups';

// These are current parcel states, not transitions during a reporting period.
const inProgressStatuses = [
  'Assigned',
  'PickedUp',
  'InTransit',
  'OutForDelivery',
];

export function dispatchSnapshot(zones: ZoneSummaryResponse['zones']) {
  const workloads = buildZoneMatrix(zones).rows.map((zone) => ({
    ...zone,
    ...zoneStatusGroupCounts(zone.statusCounts),
    awaiting: zone.statusCounts.Created ?? 0,
    active: inProgressStatuses.reduce(
      (sum, status) => sum + (zone.statusCounts[status] ?? 0),
      0,
    ),
  }));
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
