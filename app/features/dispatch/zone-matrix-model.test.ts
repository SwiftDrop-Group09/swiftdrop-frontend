import { describe, expect, it } from 'vitest';
import type { ZoneSummaryResponse } from '~/features/admin-delivery/contracts';
import {
  buildZoneMatrix,
  formatZoneCount,
  zoneCountShade,
} from './zone-matrix-model';

type Zone = ZoneSummaryResponse['zones'][number];
function zone(
  n: number,
  name: string,
  statusCounts: Zone['statusCounts'] = {},
  total = 99,
): Zone {
  return {
    zoneId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name,
    total,
    statusCounts,
  };
}

describe('Zone matrix model', () => {
  it('sorts by booked plus unsuccessful and cancelled, then name and stable ID', () => {
    const zones = [
      zone(5, 'Busy', { Assigned: 100, Delivered: 100 }),
      zone(4, 'Zulu', { Created: 3, Failed: 2, Cancelled: 1 }),
      zone(3, 'Alpha', { Created: 6 }),
      zone(2, 'Alpha', { Failed: 6 }),
      zone(1, 'Zero'),
    ];
    const model = buildZoneMatrix(zones);
    expect(model.rows.map((row) => row.zoneId)).toEqual([
      zones[3]!.zoneId,
      zones[2]!.zoneId,
      zones[1]!.zoneId,
      zones[0]!.zoneId,
      zones[4]!.zoneId,
    ]);
    expect(zones.map((row) => row.name)).toEqual([
      'Busy',
      'Zulu',
      'Alpha',
      'Alpha',
      'Zero',
    ]);
    expect(model.rows[0]!.total).toBe(99);
  });

  it('retains every additional status in a consistently ordered group', () => {
    const model = buildZoneMatrix([
      zone(1, 'One', { Returned: 4 }),
      zone(2, 'Two', { Rerouted: 2, Created: 1 }),
    ]);
    expect(model.groups.map((group) => group.label)).toEqual([
      'Before transit',
      'On the road',
      'Done',
      'Problems',
      'Other statuses',
    ]);
    expect(model.groups.at(-1)!.columns.map((column) => column.key)).toEqual([
      'Rerouted',
      'Returned',
    ]);
    expect(model.columns.slice(0, 8).map((column) => column.key)).toEqual([
      'Created',
      'Assigned',
      'PickedUp',
      'InTransit',
      'OutForDelivery',
      'Delivered',
      'Failed',
      'Cancelled',
    ]);
    expect(model.maxima.Returned).toBe(4);
    expect(model.maxima.Rerouted).toBe(2);
  });

  it('calculates each status maximum across the full response', () => {
    const model = buildZoneMatrix([
      zone(1, 'One', { Created: 2, Assigned: 100 }),
      zone(2, 'Two', { Created: 1, Assigned: 1 }),
    ]);
    expect(zoneCountShade(1, model.maxima.Created!)).toBe(2);
    expect(zoneCountShade(1, model.maxima.Assigned!)).toBe(1);
    expect(model.maxima.Delivered).toBe(0);
  });

  it('uses four positive intensity levels and handles zero-only columns', () => {
    expect(
      [0, 1, 25, 26, 50, 51, 75, 76, 100].map((count) =>
        zoneCountShade(count, 100),
      ),
    ).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(zoneCountShade(0, 0)).toBe(0);
    expect(buildZoneMatrix([]).rows).toEqual([]);
    expect(Object.values(buildZoneMatrix([zone(1, 'Zero')]).maxima)).toEqual(
      Array(8).fill(0),
    );
  });

  it('keeps normal counts exact and compacts only values from one million', () => {
    expect(formatZoneCount(999_999)).toEqual({
      exact: '999,999',
      display: '999,999',
      compact: false,
    });
    expect(formatZoneCount(1_234_567)).toEqual({
      exact: '1,234,567',
      display: '1.2M',
      compact: true,
    });
  });
});
