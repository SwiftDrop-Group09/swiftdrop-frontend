import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { IdentityApi } from '../identity/api';
import { IdentityProvider, IdentitySession } from '../identity/session';
import { csrf, customer, json, pair } from '../identity/test-fixtures';
import { WebhookScreens } from './webhook-screens';
import type { BusinessResponse } from '../merchant/contracts';
import type {
  OneTimeWebhookResponse,
  WebhookAttemptPageResponse,
  WebhookPageResponse,
} from './contracts';

const mockMerchantUser = {
  ...customer,
  roles: ['Merchant'] as (
    'Customer' | 'Courier' | 'Merchant' | 'Dispatcher' | 'Admin'
  )[],
};

const mockApprovedBusiness: BusinessResponse = {
  id: '99999999-9999-4999-8999-999999999999',
  userId: mockMerchantUser.id,
  businessName: 'Colombo Exports Ltd',
  contactEmail: 'ops@colombo.test',
  contactPhone: '+94 77 123 4567',
  pickupAddress: '42 Main St, Colombo',
  status: 'Approved',
  rejectionReason: null,
  registeredAt: '2026-11-05T10:00:00Z',
  approvedAt: '2026-11-05T12:00:00Z',
  approvedBy: 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa',
};

const mockPendingBusiness: BusinessResponse = {
  ...mockApprovedBusiness,
  status: 'Pending',
  approvedAt: null,
  approvedBy: null,
};

const mockWebhooks: WebhookPageResponse = {
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      endpointUrl: 'https://api.merchant.com/webhook',
      events: ['delivery.delivered', 'delivery.created'],
      isActive: true,
      secretVersion: 1,
      createdAt: '2026-11-10T10:00:00Z',
      updatedAt: '2026-11-10T10:00:00Z',
    },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 20,
};

const mockAttempts: WebhookAttemptPageResponse = {
  items: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      jobId: '33333333-3333-4333-8333-333333333333',
      attemptNumber: 1,
      requestedAt: '2026-11-10T10:05:00Z',
      responseStatusCode: 200,
      durationMs: 42,
      nextRetryAt: null,
      failureReason: null,
    },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 20,
};

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

type FetchHandler = (url: string, init?: RequestInit) => Response | undefined;

function setupMount(currentUser = mockMerchantUser, handler?: FetchHandler) {
  const fetcher = vi.fn<typeof fetch>((input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (handler) {
      const customRes = handler(url, init);
      if (customRes) return Promise.resolve(customRes);
    }

    // Default Identity endpoints
    if (url.endsWith('/auth/csrf')) return Promise.resolve(json(csrf));
    if (url.endsWith('/auth/refresh'))
      return Promise.resolve(json(pair(currentUser)));
    if (url.endsWith('/users/me')) return Promise.resolve(json(currentUser));

    // Default Merchant endpoints
    if (url.endsWith('/v1/merchants/me')) {
      return Promise.resolve(json(mockApprovedBusiness));
    }

    // Default Webhook endpoints
    if (url.includes('/v1/merchant/webhooks') && url.includes('/attempts')) {
      return Promise.resolve(json(mockAttempts));
    }
    if (url.includes('/v1/merchant/webhooks')) {
      return Promise.resolve(json(mockWebhooks));
    }

    return Promise.resolve(json({ code: 'not_found' }, 404));
  });

  vi.stubGlobal('fetch', fetcher);

  const api = new IdentityApi(fetcher);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const session = new IdentitySession(api, () => queryClient.clear());

  const router = createMemoryRouter(
    [{ path: '/merchant/webhooks', element: <WebhookScreens /> }],
    { initialEntries: ['/merchant/webhooks'] },
  );

  const view = render(
    <QueryClientProvider client={queryClient}>
      <IdentityProvider session={session}>
        <RouterProvider router={router} />
      </IdentityProvider>
    </QueryClientProvider>,
  );

  return { view, fetcher, queryClient };
}

describe('WebhookScreens', () => {
  it('renders business approval required banner when merchant is Pending', async () => {
    setupMount(mockMerchantUser, (url) => {
      if (url.endsWith('/v1/merchants/me')) {
        return json(mockPendingBusiness);
      }
      return undefined;
    });

    expect(
      await screen.findByText('Business Approval Required'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Register Webhook/i }),
    ).not.toBeInTheDocument();
  });

  it('renders active subscriptions table for approved merchant', async () => {
    setupMount();

    expect(
      await screen.findByText('https://api.merchant.com/webhook'),
    ).toBeInTheDocument();
    expect(screen.getByText('delivery.delivered')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /View Attempts/i }),
    ).toBeInTheDocument();
  });

  it('views attempts timeline when clicking View Attempts and can go back', async () => {
    const user = userEvent.setup();
    setupMount();

    const viewAttemptsBtn = await screen.findByRole('button', {
      name: /View Attempts/i,
    });
    await user.click(viewAttemptsBtn);

    expect(
      await screen.findByText('Delivery Attempts History'),
    ).toBeInTheDocument();
    expect(screen.getByText('42 ms')).toBeInTheDocument();

    const backBtn = screen.getByRole('button', {
      name: /Back to Subscriptions/i,
    });
    await user.click(backBtn);

    expect(await screen.findByText('Active Subscriptions')).toBeInTheDocument();
  });

  it('registers a new webhook and reveals one-time secret modal', async () => {
    const user = userEvent.setup();
    const createdSecret: OneTimeWebhookResponse = {
      id: '55555555-5555-4555-8555-555555555555',
      endpointUrl: 'https://newendpoint.com/webhook',
      events: ['delivery.delivered'],
      secret:
        'abcdef9876543210abcdef9876543210abcdef9876543210abcdef9876543210',
      secretVersion: 1,
      createdAt: '2026-11-10T12:00:00Z',
    };

    setupMount(mockMerchantUser, (url, init) => {
      if (url.endsWith('/v1/merchant/webhooks') && init?.method === 'POST') {
        return json(createdSecret, 201);
      }
      return undefined;
    });

    const registerBtn = await screen.findByRole('button', {
      name: /Register Webhook/i,
    });
    await user.click(registerBtn);

    expect(
      await screen.findByText('Register Webhook Endpoint'),
    ).toBeInTheDocument();

    const urlInput = screen.getByPlaceholderText(
      'https://api.yourdomain.com/webhooks/swiftdrop',
    );
    await user.type(urlInput, 'https://newendpoint.com/webhook');

    const submitBtn = screen.getByRole('button', { name: /^Register$/i });
    await user.click(submitBtn);

    expect(
      await screen.findByText('Webhook Signing Secret Generated'),
    ).toBeInTheDocument();
    expect(screen.getByText(createdSecret.secret)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', {
      name: /I have saved my secret/i,
    });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(
        screen.queryByText('Webhook Signing Secret Generated'),
      ).not.toBeInTheDocument();
    });
  });
});
