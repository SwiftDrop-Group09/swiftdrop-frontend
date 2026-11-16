import type { ZoneSummaryResponse } from '~/features/admin-delivery/contracts';
import {
  PARCEL_STATUS_LABELS,
  type ParcelStatus,
} from '~/features/customer-tracking/contracts';

type StatusColumn = { key: string; label: string; status?: ParcelStatus };
type StatusGroup = { label: string; columns: StatusColumn[] };

const groupDefinitions: { label: string; statuses: ParcelStatus[] }[] = [
  {
    label: 'Before transit',
    statuses: ['Created', 'Assigned', 'PickedUp'],
  },
  {
    label: 'On the road',
    statuses: ['InTransit', 'OutForDelivery'],
  },
  {
    label: 'Done',
    statuses: ['Delivered'],
  },
  {
    label: 'Problems',
    statuses: ['Failed', 'Cancelled'],
  },
];

const groups: StatusGroup[] = groupDefinitions.map(({ label, statuses }) => ({
  label,
  columns: statuses.map((status) => ({
    key: status,
    label: PARCEL_STATUS_LABELS[status],
    status,
  })),
}));

function attentionCount(zone: ZoneSummaryResponse['zones'][number]) {
  return (
    (zone.statusCounts.Created ?? 0) +
    (zone.statusCounts.Failed ?? 0) +
    (zone.statusCounts.Cancelled ?? 0)
  );
}

export function buildZoneMatrix(zones: ZoneSummaryResponse['zones']) {
  const known = new Set(
    groups.flatMap((group) => group.columns.map((column) => column.key)),
  );
  const additional = [
    ...new Set(zones.flatMap((zone) => Object.keys(zone.statusCounts))),
  ]
    .filter((key) => !known.has(key))
    .sort((a, b) => a.localeCompare(b));
  const matrixGroups: StatusGroup[] = additional.length
    ? [
        ...groups,
        {
          label: 'Other statuses',
          columns: additional.map((key) => ({ key, label: key })),
        },
      ]
    : groups;
  const columns = matrixGroups.flatMap((group) => group.columns);
  const maxima = Object.fromEntries(
    columns.map(({ key }) => [
      key,
      zones.reduce(
        (max, zone) => Math.max(max, zone.statusCounts[key] ?? 0),
        0,
      ),
    ]),
  );
  const rows = [...zones].sort(
    (a, b) =>
      attentionCount(b) - attentionCount(a) ||
      a.name.localeCompare(b.name) ||
      a.zoneId.localeCompare(b.zoneId),
  );
  return { groups: matrixGroups, columns, maxima, rows };
}

export function zoneCountShade(count: number, maximum: number) {
  if (count === 0 || maximum === 0) return 0;
  return Math.min(4, Math.ceil((count / maximum) * 4));
}

const exactFormat = new Intl.NumberFormat('en-LK');
const compactFormat = new Intl.NumberFormat('en-LK', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatZoneCount(count: number) {
  return {
    exact: exactFormat.format(count),
    display:
      count >= 1_000_000
        ? compactFormat.format(count)
        : exactFormat.format(count),
    compact: count >= 1_000_000,
  };
}
