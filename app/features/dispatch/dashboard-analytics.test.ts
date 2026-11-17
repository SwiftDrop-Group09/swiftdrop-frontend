import { describe, expect, it } from 'vitest';
import type { ZoneSummaryResponse } from '~/features/admin-delivery/contracts';
import { dispatchSnapshot } from './dashboard-analytics';
import { buildZoneMatrix } from './zone-matrix-model';

function zone(
  name: string,
  statusCounts: Record<string, number>,
  total = 999,
): ZoneSummaryResponse['zones'][number] {
  return { zoneId: name, name, statusCounts, total };
}

describe('Dispatcher dashboard zone analytics', () => {
  it('groups all statuses without changing operational KPI meanings or API totals', () => {
    const snapshot = dispatchSnapshot([
      zone('All statuses', {
        Created: 7,
        Assigned: 2,
        PickedUp: 3,
        InTransit: 4,
        OutForDelivery: 5,
        Delivered: 100,
        Failed: 20,
        Cancelled: 10,
        Returned: 6,
        Rerouted: 2,
      }),
      zone('Omitted statuses', {}),
    ]);
    expect(snapshot.workloads[0]).toMatchObject({
      beforeTransit: 12,
      onRoad: 9,
      done: 100,
      problems: 30,
      other: 8,
      total: 999,
    });
    expect(snapshot.workloads[1]).toMatchObject({
      beforeTransit: 0,
      onRoad: 0,
      done: 0,
      problems: 0,
      other: 0,
    });
    expect(snapshot.inProgress).toBe(14);
    expect(snapshot.outForDelivery).toBe(5);
    expect(snapshot.zonesWithBacklog).toBe(1);
  });

  it('matches matrix attention ordering rather than letting delivered volume hide problems', () => {
    const zones = [
      zone('Completed volume', { Delivered: 1_000_000 }),
      zone('On the road', { InTransit: 1_000 }),
      zone('Needs assignment', { Created: 2 }),
      zone('Failed deliveries', { Failed: 3 }),
      zone('Cancelled bookings', { Cancelled: 4 }),
      { ...zone('Tie', { Created: 2 }), zoneId: 'b' },
      { ...zone('Tie', { Failed: 2 }), zoneId: 'a' },
    ];
    const snapshot = dispatchSnapshot(zones);
    expect(snapshot.workloads.map((row) => row.zoneId)).toEqual(
      buildZoneMatrix(zones).rows.map((row) => row.zoneId),
    );
    expect(snapshot.workloads.slice(0, 3).map((row) => row.name)).toEqual([
      'Cancelled bookings',
      'Failed deliveries',
      'Needs assignment',
    ]);
    expect(zones[0]!.name).toBe('Completed volume');
  });
});
