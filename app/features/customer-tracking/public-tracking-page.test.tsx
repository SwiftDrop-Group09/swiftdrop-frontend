import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { PublicTrackingPage } from './public-tracking-page';
import * as api from './api';
import type { PublicTrackingSummary } from './contracts';

const mockIdentity = vi.hoisted(() => ({
  user: null,
  restoring: false,
  session: {
    api: { base: '/api' },
    authenticatedRequest: vi.fn(),
    getSnapshot: () => ({ user: null }),
  },
}));

vi.mock('~/features/identity/session', () => ({
  useIdentity: () => mockIdentity,
  useOptionalIdentity: () => mockIdentity,
}));

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    getPublicTracking: vi.fn(),
    subscribePublicTracking: vi.fn(),
  };
});

function renderPublicTrackingPage(initialPath = '/track') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const router = createMemoryRouter(
    [
      { path: '/track', element: <PublicTrackingPage /> },
      { path: '/', element: <div data-testid="home-route">Home</div> },
      {
        path: '/dashboard',
        element: <div data-testid="dashboard-route">Dashboard</div>,
      },
    ],
    { initialEntries: [initialPath] },
  );

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
    user: userEvent.setup(),
  };
}

describe('PublicTrackingPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.subscribePublicTracking).mockImplementation(
      () => new Promise(() => {}),
    );
    localStorage.clear();
  });

  it('renders initial tracking state with search input, milestone guide, and FAQs when no code is active', () => {
    renderPublicTrackingPage('/track');

    // Branding and header
    expect(screen.getByLabelText('SwiftDrop home')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /track your parcel/i }),
    ).toBeInTheDocument();

    // Input form
    const input = screen.getByLabelText(/tracking number/i);
    expect(input).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^track$/i })).toBeDisabled();

    // Delivery journey guide (fixes empty / alone UI)
    expect(
      screen.getByText(/how swiftdrop delivery tracking works/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Booked')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('In Transit')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();

    // Helpful FAQs
    expect(
      screen.getByText(/where is my tracking number\?/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/verified proof of delivery/i)).toBeInTheDocument();
  });

  it('submits a new tracking code and updates search params', async () => {
    vi.mocked(api.getPublicTracking).mockResolvedValue({
      trackingNumber: 'TRK-COLOMBO-99',
      status: 'Created',
      originCity: 'Colombo',
      destinationCity: 'Galle',
      lastUpdatedAt: '2026-11-20T10:00:00Z',
      timeline: [],
    });

    const { user, router } = renderPublicTrackingPage('/track');

    const input = screen.getByLabelText(/tracking number/i);
    const trackButton = screen.getByRole('button', { name: /^track$/i });

    await user.type(input, 'TRK-COLOMBO-99');
    expect(trackButton).toBeEnabled();

    await user.click(trackButton);

    expect(router.state.location.search).toBe('?code=TRK-COLOMBO-99');
  });

  it('displays parcel tracking details, route, stepper, and timeline when parcel data is returned', async () => {
    const mockSummary: PublicTrackingSummary = {
      trackingNumber: 'TRK-PUB-101',
      status: 'InTransit',
      originCity: 'Colombo',
      destinationCity: 'Kandy',
      lastUpdatedAt: '2026-11-20T10:00:00Z',
      timeline: [
        {
          status: 'Created',
          timestamp: '2026-11-20T08:00:00Z',
          label: 'Parcel booked by sender',
        },
        {
          status: 'InTransit',
          timestamp: '2026-11-20T10:00:00Z',
          label: 'Departed sorting hub for Kandy',
        },
      ],
    };

    vi.mocked(api.getPublicTracking).mockResolvedValue(mockSummary);

    renderPublicTrackingPage('/track?code=TRK-PUB-101');

    // Heading and tracking number
    expect(await screen.findByText('TRK-PUB-101')).toBeInTheDocument();

    // Origin to destination
    expect(screen.getByText(/Colombo/)).toBeInTheDocument();
    expect(screen.getAllByText(/Kandy/).length).toBeGreaterThan(0);

    // Timeline entries
    expect(screen.getByText('Parcel booked by sender')).toBeInTheDocument();
    expect(
      screen.getByText('Departed sorting hub for Kandy'),
    ).toBeInTheDocument();

    // Copy and share buttons exist
    expect(
      screen.getByRole('button', { name: /copy tracking number/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /share tracking link/i }),
    ).toBeInTheDocument();
  });

  it('displays not found error alert and troubleshooting tips when parcel does not exist', async () => {
    vi.mocked(api.getPublicTracking).mockRejectedValue(
      new Error('Parcel not found'),
    );

    renderPublicTrackingPage('/track?code=TRK-INVALID-999');

    expect(
      await screen.findByText(/tracking number not found/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/could not locate any parcel matching/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /try another number/i }),
    ).toBeInTheDocument();
  });

  it('falls back to REST, reconnects with the current timeline and aborts on unmount', async () => {
    const trackingNumber = 'TRK-LIVE-1';
    const initial: PublicTrackingSummary = {
      trackingNumber,
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
    };
    const lastUpdatedAt = '2026-10-16T09:00:00Z';
    const updated: PublicTrackingSummary = {
      ...initial,
      status: 'InTransit',
      lastUpdatedAt,
      timeline: [
        ...initial.timeline,
        {
          status: 'InTransit',
          timestamp: lastUpdatedAt,
          label: 'Parcel collected',
        },
      ],
    };
    vi.mocked(api.getPublicTracking)
      .mockResolvedValueOnce(initial)
      .mockResolvedValue(updated);
    const subscribe = vi.mocked(api.subscribePublicTracking);
    subscribe.mockRejectedValueOnce(new Error('stream unavailable'));
    const view = renderPublicTrackingPage('/track?code=' + trackingNumber);
    expect(await screen.findByText(/checking every 4s/i)).toBeVisible();
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(2), {
      timeout: 6000,
    });
    const [, , signal, receive] = subscribe.mock.calls[1]!;
    act(() => {
      receive({ trackingNumber, status: 'InTransit', lastUpdatedAt });
      receive({ trackingNumber, status: 'InTransit', lastUpdatedAt });
      receive({
        trackingNumber,
        status: 'Created',
        lastUpdatedAt: initial.lastUpdatedAt,
      });
    });
    expect(await screen.findByText('Parcel collected')).toBeVisible();
    expect(screen.getAllByText('Parcel collected')).toHaveLength(1);
    expect(screen.getByText('Live updates connected')).toBeVisible();
    expect(api.getPublicTracking).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(signal.aborted).toBe(true);
  }, 9000);
});
