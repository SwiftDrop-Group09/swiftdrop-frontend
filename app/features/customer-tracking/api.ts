import type { AuthenticatedRequest } from '~/features/identity/contracts';
import type {
  CustomerParcelPage,
  CustomerParcelQuery,
  ParcelDetail,
  ParcelEventSnapshot,
  ParcelEventsResponse,
  ParcelReceipt,
  ProofOfDeliveryInfo,
  PublicTrackingSummary,
} from './contracts';

export class CustomerTrackingApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message = 'The tracking request could not be completed.',
  ) {
    super(message);
  }
}

async function readError(
  response: Response,
): Promise<CustomerTrackingApiError> {
  try {
    const body = (await response.json()) as {
      code?: string;
      title?: string;
      detail?: string;
    };
    return new CustomerTrackingApiError(
      body.code ?? `http_${response.status}`,
      response.status,
      body.detail ??
        body.title ??
        'The tracking request could not be completed.',
    );
  } catch {
    return new CustomerTrackingApiError(
      `http_${response.status}`,
      response.status,
    );
  }
}

export function buildParcelQueryString(query: CustomerParcelQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.zoneId) params.set('zoneId', query.zoneId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export async function listCustomerParcels(
  request: AuthenticatedRequest,
  apiBase: string,
  query: CustomerParcelQuery,
  signal?: AbortSignal,
): Promise<CustomerParcelPage> {
  const response = await request(
    `${apiBase}/v1/parcels${buildParcelQueryString(query)}`,
    { signal, cache: 'no-store' },
  );
  if (!response.ok) throw await readError(response);
  return (await response.json()) as CustomerParcelPage;
}

export async function getCustomerParcel(
  request: AuthenticatedRequest,
  apiBase: string,
  parcelId: string,
  signal?: AbortSignal,
): Promise<ParcelDetail> {
  const response = await request(
    `${apiBase}/v1/parcels/${encodeURIComponent(parcelId)}`,
    { signal, cache: 'no-store' },
  );
  if (!response.ok) throw await readError(response);
  return (await response.json()) as ParcelDetail;
}

export async function getPublicTracking(
  apiBase: string,
  trackingNumber: string,
  signal?: AbortSignal,
): Promise<PublicTrackingSummary> {
  const response = await fetch(
    `${apiBase}/v1/parcels/track/${encodeURIComponent(trackingNumber.trim())}`,
    { signal, cache: 'no-store' },
  );
  if (!response.ok) throw await readError(response);
  return (await response.json()) as PublicTrackingSummary;
}

export async function getParcelEvents(
  request: AuthenticatedRequest,
  apiBase: string,
  parcelId: string,
  signal?: AbortSignal,
): Promise<ParcelEventsResponse> {
  const response = await request(
    `${apiBase}/v1/parcels/${encodeURIComponent(parcelId)}/events?format=json`,
    {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok) throw await readError(response);
  return (await response.json()) as ParcelEventsResponse;
}

export async function getParcelReceipt(
  request: AuthenticatedRequest,
  apiBase: string,
  parcelId: string,
  signal?: AbortSignal,
): Promise<ParcelReceipt> {
  const response = await request(
    `${apiBase}/v1/parcels/${encodeURIComponent(parcelId)}/receipt?format=json`,
    {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok) throw await readError(response);
  return (await response.json()) as ParcelReceipt;
}

export async function downloadReceiptPdf(
  request: AuthenticatedRequest,
  apiBase: string,
  parcelId: string,
  trackingNumber?: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await request(
    `${apiBase}/v1/parcels/${encodeURIComponent(parcelId)}/receipt?format=pdf`,
    {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/pdf' },
    },
  );
  if (!response.ok) throw await readError(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `swiftdrop-receipt-${trackingNumber || parcelId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function getParcelProof(
  request: AuthenticatedRequest,
  apiBase: string,
  parcelId: string,
  signal?: AbortSignal,
): Promise<ProofOfDeliveryInfo> {
  const response = await request(
    `${apiBase}/v1/parcels/${encodeURIComponent(parcelId)}/pod?format=json`,
    {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok) throw await readError(response);
  return (await response.json()) as ProofOfDeliveryInfo;
}

export async function fetchParcelProofImageUrl(
  request: AuthenticatedRequest,
  apiBase: string,
  parcelId: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await request(
    `${apiBase}/v1/parcels/${encodeURIComponent(parcelId)}/pod?format=image`,
    {
      signal,
      cache: 'no-store',
      headers: { Accept: 'image/png, image/jpeg' },
    },
  );
  if (!response.ok) throw await readError(response);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function parseSseStream(
  body: ReadableStream<Uint8Array>,
  onSnapshot: (snapshot: ParcelEventSnapshot) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventName = 'message';
      return;
    }
    const raw = dataLines.join('\n');
    dataLines = [];
    const currentEvent = eventName;
    eventName = 'message';
    if (currentEvent === 'snapshot' || currentEvent === 'message') {
      try {
        const parsed = JSON.parse(raw) as ParcelEventSnapshot;
        if (
          parsed &&
          typeof parsed.id === 'string' &&
          typeof parsed.version === 'number'
        ) {
          onSnapshot(parsed);
        }
      } catch {
        // Ignore malformed frames
      }
    }
  };

  try {
    while (!signal?.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line === '') {
          dispatch();
        } else if (line.startsWith(':')) {
          // Heartbeat comment
        } else if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function subscribeParcelEvents(
  request: AuthenticatedRequest,
  apiBase: string,
  parcelId: string,
  signal: AbortSignal,
  onSnapshot: (snapshot: ParcelEventSnapshot) => void,
): Promise<void> {
  const response = await request(
    `${apiBase}/v1/parcels/${encodeURIComponent(parcelId)}/events`,
    {
      signal,
      cache: 'no-store',
      headers: { Accept: 'text/event-stream' },
    },
  );
  if (!response.ok || !response.body) {
    throw await readError(response);
  }
  await parseSseStream(response.body, onSnapshot, signal);
}
