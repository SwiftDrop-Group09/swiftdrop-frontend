import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '~/features/identity/session';
import {
  downloadReceiptPdf,
  getCustomerParcel,
  getCustomerSummary,
  getParcelProof,
  getParcelReceipt,
  getPublicTracking,
  listCustomerParcels,
  subscribeParcelEvents,
  subscribePublicTracking,
} from './api';
import type {
  CustomerParcelPage,
  CustomerDeliverySummary,
  CustomerParcelQuery,
  ParcelDetail,
  ParcelEventSnapshot,
  ParcelReceipt,
  ProofOfDeliveryInfo,
  PublicTrackingSummary,
} from './contracts';
import { isTerminal } from './navigation';

export function useCustomerSummary() {
  const { session, user, restoring } = useIdentity();
  return useQuery<CustomerDeliverySummary>({
    queryKey: ['customer-delivery-summary', user?.id],
    enabled: !restoring && !!user?.roles.includes('Customer'),
    queryFn: ({ signal }) =>
      getCustomerSummary(
        session.authenticatedRequest,
        session.api.base,
        signal,
      ),
  });
}

export function useCustomerParcels(
  query: CustomerParcelQuery,
  operational = false,
  enabled = true,
) {
  const { session, user, restoring } = useIdentity();
  return useQuery<CustomerParcelPage>({
    queryKey: ['customer-parcels', user?.id, operational, query],
    enabled:
      enabled &&
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
  pollIntervalMs: number | false = 4000,
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
  const apiBase = session.api.base;
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<{
    trackingNumber: string;
    state: LiveConnectionState;
  }>();
  const connectionState =
    connection?.trackingNumber === trackingNumber
      ? connection.state
      : 'connecting';
  const query = useQuery<PublicTrackingSummary>({
    queryKey: ['public-tracking', trackingNumber],
    enabled: Boolean(trackingNumber?.trim()),
    refetchInterval: (tracking) => {
      const status = tracking.state.data?.status;
      return connectionState === 'polling' && status && !isTerminal(status)
        ? pollIntervalMs
        : false;
    },
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) =>
      getPublicTracking(apiBase, trackingNumber!, signal),
    retry: false,
  });
  const canonicalNumber = query.data?.trackingNumber;
  const active = Boolean(query.data && !isTerminal(query.data.status));

  useEffect(() => {
    if (!active || !trackingNumber || !canonicalNumber) return;

    const queryKey = ['public-tracking', trackingNumber];
    let disposed = false;
    let controller: AbortController;
    let deadline: ReturnType<typeof setTimeout>;
    let reconnect: ReturnType<typeof setTimeout>;

    const connect = async () => {
      controller = new AbortController();
      const stream = controller;
      let lastSnapshotAt = -Infinity;
      deadline = setTimeout(() => stream.abort(), 8000);
      try {
        await subscribePublicTracking(
          apiBase,
          trackingNumber,
          stream.signal,
          (snapshot) => {
            if (
              disposed ||
              stream.signal.aborted ||
              snapshot.trackingNumber !== canonicalNumber
            )
              return;
            clearTimeout(deadline);
            // Delivery sends a reconciliation snapshot every 30 seconds.
            deadline = setTimeout(() => stream.abort(), 40000);
            setConnection({ trackingNumber, state: 'live' });
            const updatedAt = Date.parse(snapshot.lastUpdatedAt);
            if (updatedAt <= lastSnapshotAt) return;
            lastSnapshotAt = updatedAt;
            const cached =
              queryClient.getQueryData<PublicTrackingSummary>(queryKey);
            if (
              !cached ||
              updatedAt > Date.parse(cached.lastUpdatedAt) ||
              (updatedAt === Date.parse(cached.lastUpdatedAt) &&
                snapshot.status !== cached.status)
            ) {
              void queryClient.invalidateQueries({ queryKey, exact: true });
            }
          },
        );
      } catch {
        // The REST query continues updating while the stream reconnects.
      } finally {
        clearTimeout(deadline);
      }
      if (disposed) return;
      setConnection({ trackingNumber, state: 'polling' });
      reconnect = setTimeout(() => void connect(), pollIntervalMs);
    };

    void connect();
    return () => {
      disposed = true;
      clearTimeout(deadline);
      clearTimeout(reconnect);
      controller.abort();
    };
  }, [
    active,
    apiBase,
    canonicalNumber,
    pollIntervalMs,
    queryClient,
    trackingNumber,
  ]);

  return { ...query, connectionState: active ? connectionState : 'closed' };
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
  const { session, user } = useIdentity();
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
    setLatestSnapshot(null);
    let lastVersion =
      queryClient.getQueryData<ParcelDetail>([
        'customer-parcel',
        parcelId,
        user?.id,
        false,
      ])?.version ?? 0;

    const handleSnapshot = (snapshot: ParcelEventSnapshot) => {
      if (controller.signal.aborted || snapshot.id !== parcelId) return;
      setConnectionState('live');
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
      if (snapshot.version > lastVersion) {
        lastVersion = snapshot.version;
        setLatestSnapshot(snapshot);
        void queryClient.invalidateQueries({
          queryKey: ['customer-parcel', parcelId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['customer-parcels', user?.id],
        });
        void queryClient.invalidateQueries({
          queryKey: ['customer-delivery-summary', user?.id],
        });
      }
    };

    const startPollingFallback = () => {
      setConnectionState('polling');
      if (fallbackTimer) return;
      fallbackTimer = setInterval(() => {
        void queryClient
          .invalidateQueries({
            queryKey: ['customer-parcel', parcelId],
          })
          .then(() => {
            if (controller.signal.aborted) return;
            const version =
              queryClient.getQueryData<ParcelDetail>([
                'customer-parcel',
                parcelId,
                user?.id,
                false,
              ])?.version ?? 0;
            if (version > lastVersion) {
              lastVersion = version;
              void queryClient.invalidateQueries({
                queryKey: ['customer-parcels', user?.id],
              });
              void queryClient.invalidateQueries({
                queryKey: ['customer-delivery-summary', user?.id],
              });
            }
          });
      }, 4000);
    };

    const connect = async () => {
      try {
        if (!fallbackTimer) setConnectionState('connecting');
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
  }, [parcelId, active, session, user?.id, queryClient]);

  return { connectionState, latestSnapshot };
}
