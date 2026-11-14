import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CustomerDashboardContent,
  CustomerDeliveryDetail,
  CustomerHistoryContent,
} from './customer-pages';
import type { CustomerParcelListItem, ParcelDetail } from './contracts';

const identity = vi.hoisted(() => {
  const user = { id: 'owner', roles: ['Customer'], fullName: 'Nimali Perera' };
  return {
    user,
    restoring: false,
    session: {
      api: { base: '/api' },
      authenticatedRequest:
        vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(),
      getSnapshot: () => ({ user }),
    },
  };
});
vi.mock('~/features/identity/session', () => ({ useIdentity: () => identity }));
const priceSnapshot = { total: 540, currency: 'LKR', pricingVersion: 'v1' };
const item: CustomerParcelListItem = {
  id: 'parcel-1',
  trackingNumber: 'TRK-1001',
  status: 'Delivered',
  version: 4,
  priceSnapshot,
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-05T08:00:00Z',
  pickupCity: 'Colombo',
  deliveryCity: 'Kandy',
  recipientName: 'Kamal Silva',
  packageDetails: { size: 'Small', weightKg: 2 },
  hasProof: true,
};
const address = {
  street: '12 Galle Road',
  city: 'Colombo',
  postalCode: '00300',
  zoneId: 'zone',
};
const detail: ParcelDetail = {
  ...item,
  pickupAddress: address,
  deliveryAddress: { ...address, city: 'Kandy' },
  recipient: { name: item.recipientName, phoneNumber: '+94771234567' },
  assignment: null,
  history: [
    {
      fromStatus: null,
      toStatus: 'Created',
      timestamp: item.createdAt,
      changeReason: null,
      deliveryNote: null,
    },
  ],
};
function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}
function Detail() {
  const { id } = useParams();
  return <CustomerDeliveryDetail parcelId={id!} />;
}
function CurrentUrl() {
  const location = useLocation();
  return (
    <output data-testid="current-url">
      {location.pathname + location.search}
    </output>
  );
}
function mount(path: string, state?: unknown) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: path.split('?')[0],
            search: path.includes('?') ? '?' + path.split('?')[1] : '',
            state,
          },
        ]}
      >
        <CurrentUrl />
        <Routes>
          <Route path="/dashboard" element={<CustomerDashboardContent />} />
          <Route
            path="/customer/history"
            element={<CustomerHistoryContent />}
          />
          <Route path="/customer/parcels/:id" element={<Detail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  identity.session.authenticatedRequest.mockImplementation((url) => {
    if (url === '/api/v1/parcels/summary')
      return json({
        totalCount: 42,
        activeCount: 12,
        deliveredCount: 25,
        failedCount: 3,
        cancelledCount: 2,
        activeDeliveries: [{ ...item, status: 'InTransit' }],
        recentDeliveries: [item],
      });
    if (url === '/api/v1/parcels/parcel-1') return json(detail);
    if (url.includes('/receipt?'))
      return json({
        receiptNumber: 'RCP-1001',
        parcelId: item.id,
        trackingNumber: item.trackingNumber,
        status: 'Delivered',
        createdAt: item.createdAt,
        deliveredAt: item.updatedAt,
        pickupAddress: address,
        deliveryAddress: address,
        recipient: detail.recipient,
        packageDetails: item.packageDetails,
        baseFee: 450,
        weightFee: 90,
        total: 540,
        currency: 'LKR',
        pricingVersion: 'v1',
        calculatedAt: item.createdAt,
      });
    if (url.includes('/pod?')) return json({ code: 'not_found' }, 404);
    if (url.startsWith('/api/v1/parcels?'))
      return json({ items: [item], totalCount: 35, page: 3, pageSize: 10 });
    return json({ code: 'not_found' }, 404);
  });
});
afterEach(() => vi.clearAllMocks());

describe('Customer delivery experience', () => {
  it('places lookup first and provides accessible milestones on the active delivery cards', async () => {
    mount('/dashboard');
    await screen.findByText('42');
    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent(
      'Find a delivery',
    );
    const journey = screen.getByRole('progressbar', {
      name: 'Delivery milestones',
    });
    expect(journey).toHaveAttribute('aria-valuenow', '60');
    expect(journey).toHaveAttribute(
      'aria-valuetext',
      'In transit, milestone 4 of 6',
    );
    expect(
      screen.getByRole('list', { name: 'Delivery list' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('returns to the dashboard after opening details and changing tabs', async () => {
    mount('/dashboard');
    await screen.findByText('42');
    expect(screen.getByText('12')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('link', { name: 'View details' })[0]!);
    await screen.findByRole('heading', { name: 'Delivery details' });
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Tracking' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole('link', { name: 'Back to dashboard' }));
    await screen.findByRole('heading', { name: 'Welcome back, Nimali Perera' });
    expect(
      identity.session.authenticatedRequest.mock.calls.filter(
        ([url]) => url === '/api/v1/parcels/summary',
      ),
    ).toHaveLength(1);
  });

  it('preserves history search, dates, status and pagination when returning from details', async () => {
    const path =
      '/customer/history?search=Perera&status=Delivered&from=2026-11-01&to=2026-11-15&page=3';
    mount(path);
    await screen.findByText('35 deliveries · Page 3 of 4');
    fireEvent.click(screen.getAllByRole('link', { name: 'View details' })[0]!);
    await screen.findByRole('heading', { name: 'Delivery details' });
    fireEvent.click(
      screen.getByRole('link', { name: 'Back to Delivery history' }),
    );
    await screen.findByRole('heading', { name: 'Delivery history' });
    expect(screen.getByTestId('current-url')).toHaveTextContent(path);
    expect(screen.getByLabelText('Search deliveries')).toHaveValue('Perera');
    expect(screen.getByLabelText('Status')).toHaveValue('Delivered');
  });

  it('keeps documents lazy, provides direct-link Back fallback and does not poll a completed delivery', async () => {
    mount('/customer/parcels/parcel-1');
    await screen.findByText('TRK-1001');
    expect(
      screen.getByRole('link', { name: 'Back to Delivery history' }),
    ).toHaveAttribute('href', '/customer/history');
    expect(
      identity.session.authenticatedRequest.mock.calls.some(
        ([url]) =>
          url.includes('/receipt') ||
          url.includes('/pod') ||
          url.includes('/events'),
      ),
    ).toBe(false);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Documents' }), {
      button: 0,
      ctrlKey: false,
    });
    await screen.findByText('Receipt RCP-1001');
    expect(
      screen.getByRole('button', { name: 'Download PDF Receipt' }),
    ).toBeEnabled();
    await screen.findByText('No proof attached');
  });

  it('offers every documented status and resets pagination when filters change', async () => {
    mount('/customer/history?page=3');
    await screen.findByText('35 deliveries · Page 3 of 4');
    expect(screen.getAllByRole('option')).toHaveLength(9);
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'OutForDelivery' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('current-url')).toHaveTextContent(
        '/customer/history?status=OutForDelivery',
      ),
    );
    expect(screen.getByTestId('current-url')).not.toHaveTextContent('page=3');
  });

  it('rejects invalid date ranges without loading an unfiltered list', async () => {
    mount('/customer/history?from=2026-11-15&to=2026-11-01');
    await screen.findByText('Check the booking dates');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(identity.session.authenticatedRequest).not.toHaveBeenCalled();
  });

  it('does not turn a failed dashboard request into successful zero totals', async () => {
    identity.session.authenticatedRequest.mockImplementation(() =>
      json({ code: 'delivery_unavailable' }, 503),
    );
    mount('/dashboard');
    await screen.findByText('Unable to load your deliveries');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(identity.session.authenticatedRequest).toHaveBeenCalledTimes(2),
    );
  });

  it('resolves a tracking lookup through the owner-scoped list and keeps navigation inside the workspace', async () => {
    mount('/dashboard');
    await screen.findByText('42');
    fireEvent.change(screen.getByLabelText('Tracking number'), {
      target: { value: item.trackingNumber },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Find delivery' }));
    await screen.findByRole('heading', { name: 'Delivery details' });
    expect(screen.getByTestId('current-url')).toHaveTextContent(
      '/customer/parcels/parcel-1?tab=tracking',
    );
    expect(
      identity.session.authenticatedRequest.mock.calls.some(([url]) =>
        url.includes('/track/'),
      ),
    ).toBe(false);
  });
});
