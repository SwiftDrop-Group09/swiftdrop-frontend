import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '~/features/identity/contracts';
import { json } from '~/features/identity/test-fixtures';
import {
  assignmentAttempt,
  getAssignmentOptions,
  submitAssignment,
} from './assignment-api';

const parcelId = '11111111-1111-4111-8111-111111111111';
const courierId = '22222222-2222-4222-8222-222222222222';
const options = {
  parcelId,
  parcelVersion: 1,
  businessToday: '2026-11-14',
  operationsTimeZone: 'Asia/Colombo',
  serviceDate: '2026-11-14',
  items: [
    { courierId, onDuty: true, activeCountForServiceDate: 0, capacity: 2 },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 20,
};
const receipt = {
  id: parcelId,
  trackingNumber: 'TRK-1',
  status: 'Assigned',
  version: 2,
  priceSnapshot: { total: 500, currency: 'LKR', pricingVersion: 'v1' },
  createdAt: '2026-11-14T00:00:00Z',
};

describe('assignment transport', () => {
  it('keeps Int64 versions exact in eligibility reads, write bodies and receipts', async () => {
    const read = vi
      .fn<AuthenticatedRequest>()
      .mockResolvedValue(
        new Response(
          JSON.stringify(options).replace(
            '"parcelVersion":1',
            '"parcelVersion":9007199254740993',
          ),
        ),
      );
    const result = await getAssignmentOptions(
      read,
      '/api',
      parcelId,
      undefined,
      1,
    );
    expect(result.parcelVersion).toBe('9007199254740993');
    const attempt = assignmentAttempt(
      parcelId,
      courierId,
      result.parcelVersion,
      result.serviceDate,
    );
    expect(attempt.body).toContain('"expectedVersion":9007199254740993');
    const write = vi
      .fn<AuthenticatedRequest>()
      .mockResolvedValue(
        new Response(
          JSON.stringify(receipt).replace(
            '"version":2',
            '"version":9007199254740994',
          ),
        ),
      );
    expect((await submitAssignment(write, '/api', attempt)).version).toBe(
      '9007199254740994',
    );
  });
  it('explicit retry sends identical bytes and idempotency key', async () => {
    const write = vi
      .fn<AuthenticatedRequest>()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(json(receipt));
    const attempt = assignmentAttempt(parcelId, courierId, '1', '2026-11-14');
    await expect(
      submitAssignment(write, '/api', attempt),
    ).rejects.toMatchObject({ uncertain: true });
    await submitAssignment(write, '/api', attempt);
    expect(write.mock.calls[0]?.[1]?.body).toBe(write.mock.calls[1]?.[1]?.body);
    expect(write.mock.calls[0]?.[1]?.headers).toEqual(
      write.mock.calls[1]?.[1]?.headers,
    );
  });
  it.each([
    { ...options, parcelId: courierId },
    { ...options, serviceDate: '2026-11-13' },
    { ...options, items: [options.items[0], options.items[0]] },
    {
      ...options,
      items: [{ ...options.items[0], activeCountForServiceDate: 2 }],
    },
    { ...options, parcelVersion: '1' },
  ])('rejects inconsistent eligibility responses', async (body) => {
    await expect(
      getAssignmentOptions(
        vi.fn<AuthenticatedRequest>().mockResolvedValue(json(body)),
        '/api',
        parcelId,
        undefined,
        1,
      ),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('treats inconsistent success as uncertain and capacity rejection as definite', async () => {
    const attempt = assignmentAttempt(parcelId, courierId, '1', '2026-11-14');
    await expect(
      submitAssignment(
        vi
          .fn<AuthenticatedRequest>()
          .mockResolvedValue(json({ ...receipt, version: 3 })),
        '/api',
        attempt,
      ),
    ).rejects.toMatchObject({ uncertain: true });
    await expect(
      submitAssignment(
        vi
          .fn<AuthenticatedRequest>()
          .mockResolvedValue(json({ code: 'capacity_exceeded' }, 422)),
        '/api',
        attempt,
      ),
    ).rejects.toMatchObject({ uncertain: false, code: 'capacity_exceeded' });
  });
});
