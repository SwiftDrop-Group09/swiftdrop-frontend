import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { LandingPage } from './landing-page';

const mockIdentityState = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    roles: ('Customer' | 'Merchant' | 'Dispatcher' | 'Courier' | 'Admin')[];
    fullName: string;
    email: string;
  },
  restoring: false,
  error: null,
  logoutRequested: false,
  session: {
    api: { base: '/api' },
    authenticatedRequest: vi.fn(),
    getSnapshot: () => ({ user: null }),
  },
}));

vi.mock('~/features/identity/session', () => ({
  useIdentity: () => mockIdentityState,
  useOptionalIdentity: () => mockIdentityState,
}));

function renderLandingPage(initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const router = createMemoryRouter(
    [
      { path: '/', element: <LandingPage /> },
      {
        path: '/track',
        element: <div data-testid="track-route">Track Route Destination</div>,
      },
      {
        path: '/login',
        element: <div data-testid="login-route">Login Destination</div>,
      },
      {
        path: '/register',
        element: <div data-testid="register-route">Register Destination</div>,
      },
      {
        path: '/dashboard',
        element: <div data-testid="dashboard-route">Dashboard Destination</div>,
      },
    ],
    { initialEntries },
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

describe('LandingPage (Home Page)', () => {
  beforeEach(() => {
    mockIdentityState.user = null;
    mockIdentityState.restoring = false;
  });

  it('renders branding, headlines, and core platform feature sections', () => {
    renderLandingPage();

    // Brand logo
    expect(screen.getByLabelText('SwiftDrop home')).toBeInTheDocument();

    // Main hero headline
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /every parcel delivered on time/i,
      }),
    ).toBeInTheDocument();

    // Quick tracking card title
    expect(
      screen.getByRole('heading', { name: /track your delivery/i }),
    ).toBeInTheDocument();

    // Platform features section
    expect(screen.getByText('Real-Time Tracking')).toBeInTheDocument();
    expect(screen.getByText('Predictable Pricing')).toBeInTheDocument();
    expect(screen.getByText('Smart Dispatch')).toBeInTheDocument();
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();

    // Role workspaces section
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Merchant')).toBeInTheDocument();
    expect(screen.getByText('Dispatcher')).toBeInTheDocument();
    expect(screen.getByText('Courier')).toBeInTheDocument();
  });

  it('shows sign-in and create account options for unauthenticated visitors', () => {
    renderLandingPage();

    // Header guest links
    const signInLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(signInLinks.length).toBeGreaterThan(0);

    const createAccountLinks = screen.getAllByRole('link', {
      name: /create account|get started/i,
    });
    expect(createAccountLinks.length).toBeGreaterThan(0);

    // Should not display dashboard button for guest
    expect(
      screen.queryByRole('link', { name: /go to dashboard/i }),
    ).not.toBeInTheDocument();
  });

  it('shows dashboard button and user identity for authenticated users', () => {
    mockIdentityState.user = {
      id: 'cust-1',
      roles: ['Customer'],
      fullName: 'Alex Morgan',
      email: 'alex@example.com',
    };

    renderLandingPage();

    expect(screen.getByText(/Alex Morgan/i)).toBeInTheDocument();
    const dashboardLinks = screen.getAllByRole('link', {
      name: /dashboard|open your workspace/i,
    });
    expect(dashboardLinks.length).toBeGreaterThan(0);
  });

  it('submits tracking number and navigates to the public tracking route with code query parameter', async () => {
    const { user, router } = renderLandingPage();

    const input = screen.getByLabelText(/parcel tracking number/i);
    const trackButton = screen.getByRole('button', {
      name: /track parcel/i,
    });

    // Button is disabled when input is empty
    expect(trackButton).toBeDisabled();

    // Type tracking code
    await user.type(input, 'TRK-XP99-2026');
    expect(trackButton).toBeEnabled();

    await user.click(trackButton);

    // Verifies navigation to /track with code
    expect(router.state.location.pathname).toBe('/track');
    expect(router.state.location.search).toBe('?code=TRK-XP99-2026');
    expect(screen.getByTestId('track-route')).toBeInTheDocument();
  });

  it('provides a direct link to the dedicated public tracking page', () => {
    renderLandingPage();

    const dedicatedTrackLink = screen.getByRole('link', {
      name: /open dedicated tracking page/i,
    });
    expect(dedicatedTrackLink).toHaveAttribute('href', '/track');
  });
});
