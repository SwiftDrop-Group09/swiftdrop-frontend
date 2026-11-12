import { describe, expect, it, vi } from 'vitest';
import {
  buildParcelQueryString,
  CustomerTrackingApiError,
  getPublicTracking,
  listCustomerParcels,
  parseSseStream,
} from './api';
import type { ParcelEventSnapshot } from './contracts';

describe('customer-tracking api', () => {
  it('builds query strings with only defined filters', () => {
    expect(buildParcelQueryString({})).toBe('');
    expect(
      buildParcelQueryString({
        status: 'Delivered',
        search: ' TRK-123 ',
        page: 2,
        pageSize: 10,
      }),
    ).toBe('?status=Delivered&search=TRK-123&page=2&pageSize=10');
  });

  it('parses chunked SSE snapshot frames and ignores heartbeats', async () => {
    const snapshots: ParcelEventSnapshot[] = [];
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
        controller.enqueue(
          encoder.encode(
            'event: snapshot\nid: p1:2\ndata: {"id":"p1","status":"InTransit","version":2,"lastUpdatedAt":"2026-10-16T10:00:00Z"}\n\n',
          ),
        );
        controller.close();
      },
    });

    await parseSseStream(stream, (snapshot) => snapshots.push(snapshot));

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual({
      id: 'p1',
      status: 'InTransit',
      version: 2,
      lastUpdatedAt: '2026-10-16T10:00:00Z',
    });
  });

  it('surfaces ProblemDetails errors cleanly', async () => {
    const mockRequest = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ code: 'forbidden', title: 'Forbidden' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    await expect(
      listCustomerParcels(mockRequest, '/api', { page: 1 }),
    ).rejects.toMatchObject({
      name: 'Error',
      code: 'forbidden',
      status: 403,
    } satisfies Partial<CustomerTrackingApiError>);
  });

  it('fetches public tracking summary without auth headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          trackingNumber: 'TRK-PUB-1',
          status: 'Created',
          originCity: 'Colombo',
          destinationCity: 'Kandy',
          lastUpdatedAt: '2026-10-16T08:00:00Z',
          timeline: [
            {
              status: 'Created',
              timestamp: '2026-10-16T08:00:00Z',
              label: 'Booked',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const summary = await getPublicTracking('/api', ' TRK-PUB-1 ');
    expect(summary.trackingNumber).toBe('TRK-PUB-1');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/parcels/track/TRK-PUB-1',
      expect.objectContaining({ cache: 'no-store' }),
    );
    fetchSpy.mockRestore();
  });
});
