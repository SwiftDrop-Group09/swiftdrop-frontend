import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import { useLiveParcelTracking } from './hooks';

const identity = vi.hoisted(() => ({
  session: { api: { base: '/api' }, authenticatedRequest: vi.fn() },
  user: { id: 'owner', roles: ['Customer'] },
  restoring: false,
}));
vi.mock('~/features/identity/session', () => ({ useIdentity: () => identity }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup(active = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(['customer-parcel', 'parcel', 'owner', false], {
    version: 10,
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    ...renderHook(({ enabled }) => useLiveParcelTracking('parcel', enabled), {
      wrapper,
      initialProps: { enabled: active },
    }),
    client,
    invalidate,
  };
}

describe('owner live tracking', () => {
  it('avoids duplicate detail reads for the initial snapshot and refreshes owner lists only for a newer version', () => {
    let snapshot!: Parameters<typeof api.subscribeParcelEvents>[4];
    vi.spyOn(api, 'subscribeParcelEvents').mockImplementation(
      (_request, _base, _id, signal, callback) => {
        snapshot = callback;
        return new Promise((resolve) =>
          signal.addEventListener('abort', () => resolve()),
        );
      },
    );
    const view = setup();
    act(() =>
      snapshot({
        id: 'parcel',
        status: 'InTransit',
        version: 10,
        lastUpdatedAt: '2026-11-15T00:00:00Z',
      }),
    );
    expect(view.result.current.connectionState).toBe('live');
    expect(view.invalidate).not.toHaveBeenCalled();
    act(() =>
      snapshot({
        id: 'parcel',
        status: 'OutForDelivery',
        version: 11,
        lastUpdatedAt: '2026-11-15T00:01:00Z',
      }),
    );
    expect(
      view.invalidate.mock.calls.map(([filter]) => filter?.queryKey),
    ).toEqual([
      ['customer-parcel', 'parcel'],
      ['customer-parcels', 'owner'],
      ['customer-delivery-summary', 'owner'],
    ]);
    act(() =>
      snapshot({
        id: 'another-parcel',
        status: 'Delivered',
        version: 99,
        lastUpdatedAt: '',
      }),
    );
    expect(view.invalidate).toHaveBeenCalledTimes(3);
    view.unmount();
  });

  it('polls only while disconnected, stops polling after reconnection and aborts the stream on unmount', async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    vi.spyOn(api, 'subscribeParcelEvents')
      .mockRejectedValueOnce(new Error('disconnected'))
      .mockImplementation((_request, _base, _id, streamSignal, callback) => {
        signal = streamSignal;
        callback({
          id: 'parcel',
          status: 'InTransit',
          version: 10,
          lastUpdatedAt: '',
        });
        return new Promise((resolve) =>
          streamSignal.addEventListener('abort', () => resolve()),
        );
      });
    const view = setup();
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.result.current.connectionState).toBe('polling');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(view.result.current.connectionState).toBe('live');
    const reads = view.invalidate.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });
    expect(view.invalidate).toHaveBeenCalledTimes(reads);
    view.unmount();
    expect(signal.aborted).toBe(true);
  });

  it('does not open a stream for terminal or unavailable parcels', () => {
    const stream = vi.spyOn(api, 'subscribeParcelEvents');
    const view = setup(false);
    expect(stream).not.toHaveBeenCalled();
    expect(view.result.current.connectionState).toBe('closed');
  });
});
