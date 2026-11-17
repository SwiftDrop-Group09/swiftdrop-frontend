import type { ParcelStatus } from '~/features/customer-tracking/contracts';

export const ZONE_STATUS_GROUPS = [
  {
    key: 'beforeTransit',
    label: 'Before transit',
    statuses: ['Created', 'Assigned', 'PickedUp'],
  },
  {
    key: 'onRoad',
    label: 'On the road',
    statuses: ['InTransit', 'OutForDelivery'],
  },
  { key: 'done', label: 'Done', statuses: ['Delivered'] },
  { key: 'problems', label: 'Problems', statuses: ['Failed', 'Cancelled'] },
] as const satisfies readonly {
  key: string;
  label: string;
  statuses: readonly ParcelStatus[];
}[];

type GroupKey = (typeof ZONE_STATUS_GROUPS)[number]['key'];
const knownStatuses = new Set<string>(
  ZONE_STATUS_GROUPS.flatMap((group) => [...group.statuses]),
);

export function zoneStatusGroupCounts(statusCounts: Record<string, number>) {
  const groups = Object.fromEntries(
    ZONE_STATUS_GROUPS.map((group) => [
      group.key,
      group.statuses.reduce(
        (sum, status) => sum + (statusCounts[status] ?? 0),
        0,
      ),
    ]),
  ) as Record<GroupKey, number>;
  return {
    ...groups,
    other: Object.entries(statusCounts).reduce(
      (sum, [status, count]) => sum + (knownStatuses.has(status) ? 0 : count),
      0,
    ),
  };
}
