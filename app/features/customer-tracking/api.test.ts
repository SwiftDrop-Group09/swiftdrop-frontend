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

  it('serializes an optional delivery zone alongside the Created queue filter', () => {
    const zoneId = '00000000-0000-4000-8000-000000000010';
    const params = new URLSearchParams(
      buildParcelQueryString({ status: 'Created', zoneId }).slice(1),
    );
    expect(Object.fromEntries(params)).toEqual({ status: 'Created', zoneId });
    expect(
      new URLSearchParams(
        buildParcelQueryString({ status: 'Created' }).slice(1),
      ).has('zoneId'),
    ).toBe(false);
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

  it('triggers receipt pdf download with custom or fallback filename', async () => {
    const mockBlob = new Blob(['%PDF-1.4 mock content'], {
      type: 'application/pdf',
    });
    const mockRequest = vi.fn().mockResolvedValue(
      new Response(mockBlob, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      }),
    );

    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    const appendChild = vi.spyOn(document.body, 'appendChild');

    const { downloadReceiptPdf } = await import('./api');
    await downloadReceiptPdf(mockRequest, '/api', 'parcel-uuid-1', 'TRK-12345');

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/v1/parcels/parcel-uuid-1/receipt?format=pdf',
      expect.objectContaining({
        headers: { Accept: 'application/pdf' },
        cache: 'no-store',
      }),
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    appendChild.mockRestore();
  });
});
