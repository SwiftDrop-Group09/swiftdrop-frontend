import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '~/features/identity/session';
import {
  downloadReceiptPdf,
  getCustomerParcel,
  getParcelProof,
  getParcelReceipt,
  getPublicTracking,
  listCustomerParcels,
  subscribeParcelEvents,
} from './api';
import type {
  CustomerParcelPage,
  CustomerParcelQuery,
  ParcelDetail,
  ParcelEventSnapshot,
  ParcelReceipt,
  ProofOfDeliveryInfo,
  PublicTrackingSummary,
} from './contracts';

export function useCustomerParcels(
  query: CustomerParcelQuery,
  operational = false,
) {
  const { session, user, restoring } = useIdentity();
  return useQuery<CustomerParcelPage>({
    queryKey: ['customer-parcels', user?.id, operational, query],
    enabled:
      !restoring &&
      !!user &&
      (operational
        ? user.roles.some((role) => role === 'Admin' || role === 'Dispatcher')
        : user.roles.includes('Customer')),
    queryFn: ({ signal }) =>
      listCustomerParcels(
        session.authenticatedRequest,
        session.api.base,
        query,
        signal,
      ),
  });
}

export function useCustomerParcel(
  parcelId: string | undefined,
  operational = false,
  pollIntervalMs = 4000,
) {
  const { session, user, restoring } = useIdentity();
  return useQuery<ParcelDetail>({
    queryKey: ['customer-parcel', parcelId, user?.id, operational],
    enabled:
      !restoring &&
      !!user &&
      (operational
        ? user.roles.some((role) => role === 'Admin' || role === 'Dispatcher')
        : user.roles.includes('Customer')) &&
      Boolean(parcelId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (
        !status ||
        status === 'Delivered' ||
        status === 'Failed' ||
        status === 'Cancelled'
      ) {
        return false;
      }
      return pollIntervalMs;
    },
    queryFn: ({ signal }) =>
      getCustomerParcel(
        session.authenticatedRequest,
        session.api.base,
        parcelId!,
        signal,
      ),
  });
}

export function usePublicTracking(
  trackingNumber: string | null,
  pollIntervalMs = 4000,
) {
  const { session } = useIdentity();
  return useQuery<PublicTrackingSummary>({
    queryKey: ['public-tracking', trackingNumber],
    enabled: Boolean(trackingNumber?.trim()),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (
        !status ||
        status === 'Delivered' ||
        status === 'Failed' ||
        status === 'Cancelled'
      ) {
        return false;
      }
      return pollIntervalMs;
    },
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) =>
      getPublicTracking(session.api.base, trackingNumber!, signal),
    retry: false,
  });
}

export function useParcelReceipt(
  parcelId: string | undefined,
  operational = false,
) {
  const { session, user, restoring } = useIdentity();
  return useQuery<ParcelReceipt>({
    queryKey: ['parcel-receipt', parcelId, user?.id, operational],
    enabled:
      !restoring &&
      !!user?.roles.includes(operational ? 'Admin' : 'Customer') &&
      Boolean(parcelId),
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

export function useParcelProof(
  parcelId: string | undefined,
  enabled = true,
  operational = false,
) {
  const { session, user, restoring } = useIdentity();
  return useQuery<ProofOfDeliveryInfo>({
    queryKey: ['parcel-proof', parcelId, user?.id, operational],
    enabled:
      !restoring &&
      !!user?.roles.includes(operational ? 'Admin' : 'Customer') &&
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

export function useDownloadReceiptPdf() {
  const { session } = useIdentity();
  const [downloadingParcelId, setDownloadingParcelId] = useState<string | null>(
    null,
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const download = useCallback(
    async (parcelId: string, trackingNumber?: string) => {
      setDownloadingParcelId(parcelId);
      setDownloadError(null);
      try {
        await downloadReceiptPdf(
          session.authenticatedRequest,
          session.api.base,
          parcelId,
          trackingNumber,
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to download PDF receipt right now. Please try again.';
        setDownloadError(message);
        throw err;
      } finally {
        setDownloadingParcelId(null);
      }
    },
    [session],
  );

  return {
    downloadReceiptPdf: download,
    downloadingParcelId,
    downloadError,
  };
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
      }, 4000);
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
          }, 4000);
        }
      } catch {
        if (!controller.signal.aborted) {
          startPollingFallback();
          reconnectTimer = setTimeout(() => {
            if (!controller.signal.aborted) void connect();
          }, 4000);
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
