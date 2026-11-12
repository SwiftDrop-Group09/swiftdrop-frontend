import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '~/features/identity/session';
import {
  getCustomerParcel,
  getParcelProof,
  getParcelReceipt,
  getPublicTracking,
  listCustomerParcels,
  subscribeParcelEvents,
} from './api';
import type { CustomerParcelQuery, ParcelEventSnapshot } from './contracts';

export function useCustomerParcels(query: CustomerParcelQuery) {
  const { session, user, restoring } = useIdentity();
  return useQuery({
    queryKey: ['customer-parcels', user?.id, query],
    enabled: !restoring && !!user?.roles.includes('Customer'),
    queryFn: ({ signal }) =>
      listCustomerParcels(
        session.authenticatedRequest,
        session.api.base,
        query,
        signal,
      ),
  });
}

export function useCustomerParcel(parcelId: string | undefined) {
  const { session, user, restoring } = useIdentity();
  return useQuery({
    queryKey: ['customer-parcel', parcelId, user?.id],
    enabled:
      !restoring && !!user?.roles.includes('Customer') && Boolean(parcelId),
    queryFn: ({ signal }) =>
      getCustomerParcel(
        session.authenticatedRequest,
        session.api.base,
        parcelId!,
        signal,
      ),
  });
}

export function usePublicTracking(trackingNumber: string | null) {
  const { session } = useIdentity();
  return useQuery({
    queryKey: ['public-tracking', trackingNumber],
    enabled: Boolean(trackingNumber?.trim()),
    queryFn: ({ signal }) =>
      getPublicTracking(session.api.base, trackingNumber!, signal),
    retry: false,
  });
}

export function useParcelReceipt(parcelId: string | undefined) {
  const { session, user, restoring } = useIdentity();
  return useQuery({
    queryKey: ['parcel-receipt', parcelId, user?.id],
    enabled:
      !restoring && !!user?.roles.includes('Customer') && Boolean(parcelId),
    queryFn: ({ signal }) =>
      getParcelReceipt(
        session.authenticatedRequest,
        session.api.base,
        parcelId!,
        signal,
      ),
    retry: false,
  });
}

export function useParcelProof(parcelId: string | undefined, enabled = true) {
  const { session, user, restoring } = useIdentity();
  return useQuery({
    queryKey: ['parcel-proof', parcelId, user?.id],
    enabled:
      !restoring &&
      !!user?.roles.includes('Customer') &&
      Boolean(parcelId) &&
      enabled,
    queryFn: ({ signal }) =>
      getParcelProof(
        session.authenticatedRequest,
        session.api.base,
        parcelId!,
        signal,
      ),
    retry: false,
  });
}

export type LiveConnectionState = 'connecting' | 'live' | 'polling' | 'closed';

export function useLiveParcelTracking(
  parcelId: string | undefined,
  active: boolean,
) {
  const { session } = useIdentity();
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] =
    useState<LiveConnectionState>('connecting');
  const [latestSnapshot, setLatestSnapshot] =
    useState<ParcelEventSnapshot | null>(null);

  useEffect(() => {
    if (!parcelId || !active) {
      setConnectionState('closed');
      return;
    }

    const controller = new AbortController();
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let lastVersion = 0;

    const handleSnapshot = (snapshot: ParcelEventSnapshot) => {
      setConnectionState('live');
      if (snapshot.version > lastVersion) {
        lastVersion = snapshot.version;
        setLatestSnapshot(snapshot);
        void queryClient.invalidateQueries({
          queryKey: ['customer-parcel', parcelId],
        });
      }
    };

    const startPollingFallback = () => {
      setConnectionState('polling');
      if (fallbackTimer) return;
      fallbackTimer = setInterval(() => {
        void queryClient.invalidateQueries({
          queryKey: ['customer-parcel', parcelId],
        });
      }, 8000);
    };

    const connect = async () => {
      try {
        setConnectionState('connecting');
        await subscribeParcelEvents(
          session.authenticatedRequest,
          session.api.base,
          parcelId,
          controller.signal,
          handleSnapshot,
        );
        if (!controller.signal.aborted) {
          startPollingFallback();
          reconnectTimer = setTimeout(() => {
            if (!controller.signal.aborted) void connect();
          }, 5000);
        }
      } catch {
        if (!controller.signal.aborted) {
          startPollingFallback();
          reconnectTimer = setTimeout(() => {
            if (!controller.signal.aborted) void connect();
          }, 8000);
        }
      }
    };

    void connect();

    return () => {
      controller.abort();
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [parcelId, active, session, queryClient]);

  return { connectionState, latestSnapshot };
}
