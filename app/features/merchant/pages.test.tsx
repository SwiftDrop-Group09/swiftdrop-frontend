import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { IdentityApi } from '../identity/api';
import { IdentityProvider, IdentitySession } from '../identity/session';
import { admin, csrf, customer, json, pair } from '../identity/test-fixtures';
import { MerchantPortalPage } from './merchant-portal-page';
import { AdminMerchantsPage } from './admin-merchants-page';
import type {
  ApiKeyResponse,
  BusinessResponse,
  OneTimeApiKeyResponse,
} from './contracts';

const mockPendingBusiness: BusinessResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: customer.id,
  businessName: 'Lanka Spices Ltd',
  contactEmail: 'spices@lanka.test',
  contactPhone: '+94 77 123 4567',
  pickupAddress: '42 Main St, Kandy',
  status: 'Pending',
  rejectionReason: null,
  registeredAt: '2026-11-04T10:00:00Z',
  approvedAt: null,
  approvedBy: null,
};

const mockApprovedBusiness: BusinessResponse = {
  ...mockPendingBusiness,
  id: '99999999-9999-4999-8999-999999999999',
  businessName: 'Colombo Tea Exports Ltd',
  contactEmail: 'tea@colombo.test',
  status: 'Approved',
  approvedAt: '2026-11-05T12:00:00Z',
  approvedBy: admin.id,
};

const mockRejectedBusiness: BusinessResponse = {
  ...mockPendingBusiness,
  status: 'Rejected',
  rejectionReason: 'Invalid tax identification provided.',
};

const mockApiKey: ApiKeyResponse = {
  id: '33333333-3333-4333-8333-333333333333',
  businessId: mockApprovedBusiness.id,
  keyPrefix: 'swd_test_87654321',
  scopes: ['orders:write', 'orders:read'],
  isActive: true,
  createdAt: '2026-11-05T14:00:00Z',
  revokedAt: null,
};

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

type FetchHandler = (url: string, init?: RequestInit) => Response | undefined;

function setupMount(
  initialPath: string,
  currentUser = customer,
  handler?: FetchHandler,
) {
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
      return Promise.resolve(json({ code: 'business_not_found' }, 404));
    }
    if (url.endsWith('/v1/merchants/api-keys')) {
      return Promise.resolve(json([]));
    }
    if (url.endsWith('/v1/merchants')) {
      return Promise.resolve(json([mockPendingBusiness, mockApprovedBusiness]));
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
    [
      { path: '/merchant', element: <MerchantPortalPage /> },
      { path: '/admin/merchants', element: <AdminMerchantsPage /> },
    ],
    { initialEntries: [initialPath] },
  );

  const view = render(
    <QueryClientProvider client={queryClient}>
      <IdentityProvider session={session}>
        <RouterProvider router={router} />
      </IdentityProvider>
    </QueryClientProvider>,
  );

  return { ...view, fetcher };
}

describe('Merchant Portal Screens', () => {
  it('renders onboarding registration form when user has no registered business', async () => {
    setupMount('/merchant');

    expect(await screen.findByLabelText(/Business Name/i)).toBeInTheDocument();

    expect(
      screen.getByLabelText(/Business Contact Email/i),
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/Contact Phone Number/i)).toBeInTheDocument();

    expect(
      screen.getByLabelText(/Default Pickup Address/i),
    ).toBeInTheDocument();
  });

  it('validates registration input fields', async () => {
    const user = userEvent.setup();
    setupMount('/merchant');

    const submitBtn = await screen.findByRole('button', {
      name: /Submit Application/i,
    });
    await user.click(submitBtn);

    expect(
      await screen.findByText(/Business name is required/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Contact email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Contact phone is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Pickup address is required/i)).toBeInTheDocument();
  });

  it('submits registration successfully and shows pending status', async () => {
    const user = userEvent.setup();

    setupMount('/merchant', customer, (url, init) => {
      if (url.endsWith('/v1/merchants/register') && init?.method === 'POST') {
        return json(mockPendingBusiness, 201);
      }
      return undefined;
    });

    await screen.findByRole('heading', { name: /Merchant Registration/i });

    await user.type(
      screen.getByLabelText(/Business Name/i),
      'Lanka Spices Ltd',
    );
    await user.type(
      screen.getByLabelText(/Business Contact Email/i),
      'spices@lanka.test',
    );
    await user.type(
      screen.getByLabelText(/Contact Phone Number/i),
      '+94 77 123 4567',
    );
    await user.type(
      screen.getByLabelText(/Default Pickup Address/i),
      '42 Main St, Kandy',
    );

    await user.click(
      screen.getByRole('button', { name: /Submit Application/i }),
    );

    expect(
      await screen.findByText(/Application Pending Approval/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Lanka Spices Ltd/i)).toBeInTheDocument();
  });

  it('displays pending banner when application is pending', async () => {
    setupMount('/merchant', customer, (url) => {
      if (url.endsWith('/v1/merchants/me')) {
        return json(mockPendingBusiness);
      }
      return undefined;
    });

    expect(
      await screen.findByText(/Application Pending Approval/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pending Review/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /API key generation is disabled while your business status is/i,
      ),
    ).toBeInTheDocument();
  });

  it('displays rejection banner and reason when application is rejected', async () => {
    setupMount('/merchant', customer, (url) => {
      if (url.endsWith('/v1/merchants/me')) {
        return json(mockRejectedBusiness);
      }
      return undefined;
    });

    expect(
      await screen.findByText(/Application Rejected/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Reason: Invalid tax identification provided/i),
    ).toBeInTheDocument();
  });

  it('renders API Key Manager when business is approved', async () => {
    setupMount('/merchant', customer, (url) => {
      if (url.endsWith('/v1/merchants/me')) return json(mockApprovedBusiness);
      if (url.endsWith('/v1/merchants/api-keys')) return json([mockApiKey]);
      return undefined;
    });

    expect(
      await screen.findByText(/Account Approved & Active/i),
    ).toBeInTheDocument();
    expect(await screen.findByText(/swd_test_87654321/i)).toBeInTheDocument();
    expect(screen.getByText(/orders:write/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Generate Key/i }),
    ).toBeInTheDocument();
  });

  it('opens Generate Key modal and displays one-time secret key after creation', async () => {
    const user = userEvent.setup();
    const oneTimeKey: OneTimeApiKeyResponse = {
      keyId: '44444444-4444-4444-8444-444444444444',
      apiKey: 'swd_test_87654321_secrettoken123',
      scopes: ['orders:read'],
    };

    setupMount('/merchant', customer, (url, init) => {
      if (url.endsWith('/v1/merchants/me')) return json(mockApprovedBusiness);
      if (url.endsWith('/v1/merchants/api-keys') && init?.method === 'POST') {
        return json(oneTimeKey, 201);
      }
      if (url.endsWith('/v1/merchants/api-keys')) return json([mockApiKey]);
      return undefined;
    });

    const generateBtn = await screen.findByRole('button', {
      name: /Generate Key/i,
    });
    await user.click(generateBtn);

    expect(
      await screen.findByText(/Generate New API Key/i),
    ).toBeInTheDocument();

    const scopeCheckbox = screen.getByRole<HTMLInputElement>('checkbox', {
      name: /orders:write/i,
    });
    if (!scopeCheckbox.checked) {
      await user.click(scopeCheckbox);
    }

    const submitCreate = screen.getByRole('button', { name: /^Create Key$/i });
    await user.click(submitCreate);

    expect(await screen.findByText(/Save Your API Key/i)).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('swd_test_87654321_secrettoken123'),
    ).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', {
      name: /I have stored this key securely/i,
    });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Save Your API Key/i)).not.toBeInTheDocument();
    });
  });

  it('revokes an active API key upon confirmation', async () => {
    const user = userEvent.setup();
    let revoked = false;

    setupMount('/merchant', customer, (url, init) => {
      if (url.endsWith('/v1/merchants/me')) return json(mockApprovedBusiness);
      if (
        url.includes('/v1/merchants/api-keys/') &&
        init?.method === 'DELETE'
      ) {
        revoked = true;
        return new Response(null, { status: 204 });
      }
      if (url.endsWith('/v1/merchants/api-keys')) {
        return json(
          revoked
            ? [
                {
                  ...mockApiKey,
                  isActive: false,
                  revokedAt: '2026-11-06T00:00:00Z',
                },
              ]
            : [mockApiKey],
        );
      }
      return undefined;
    });

    const revokeBtn = await screen.findByRole('button', { name: /^Revoke$/i });
    await user.click(revokeBtn);

    expect(
      await screen.findByText(
        /Are you sure you want to revoke this API key\?/i,
      ),
    ).toBeInTheDocument();

    const confirmRevoke = screen.getByRole('button', { name: /^Revoke Key$/i });
    await user.click(confirmRevoke);

    await waitFor(() => {
      expect(revoked).toBe(true);
    });
  });
});

describe('Admin Merchant Approvals Screens', () => {
  it('blocks non-admin users from accessing merchant approvals', async () => {
    setupMount('/admin/merchants', customer);

    expect(
      await screen.findByText(
        /You do not have permission to view user administration/i,
      ),
    ).toBeInTheDocument();
  });

  it('renders merchant approvals dashboard for admin', async () => {
    setupMount('/admin/merchants', admin, (url) => {
      if (url.endsWith('/v1/merchants')) {
        return json([mockPendingBusiness, mockApprovedBusiness]);
      }
      return undefined;
    });

    expect(
      await screen.findByRole('heading', { name: /Merchant Approvals/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Lanka Spices Ltd')).toBeInTheDocument();
    expect(screen.getByText(/spices@lanka.test/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Approve$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Reject$/i }),
    ).toBeInTheDocument();
  });

  it('approves a pending merchant directly', async () => {
    const user = userEvent.setup();
    let approved = false;

    setupMount('/admin/merchants', admin, (url, init) => {
      if (url.includes('/status') && init?.method === 'PUT') {
        approved = true;
        return json({ ...mockPendingBusiness, status: 'Approved' });
      }
      if (url.endsWith('/v1/merchants')) {
        return json([
          approved
            ? { ...mockPendingBusiness, status: 'Approved' }
            : mockPendingBusiness,
        ]);
      }
      return undefined;
    });

    const approveBtn = await screen.findByRole('button', {
      name: /^Approve$/i,
    });
    await user.click(approveBtn);

    await waitFor(() => {
      expect(approved).toBe(true);
    });
  });

  it('rejects a pending merchant with a reason', async () => {
    const user = userEvent.setup();
    let rejectReason: string | null = null;

    setupMount('/admin/merchants', admin, (url, init) => {
      if (url.includes('/status') && init?.method === 'PUT') {
        const body = (
          typeof init.body === 'string'
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : {}
        ) as { reason?: string };
        const reason = body.reason ?? null;
        rejectReason = reason;
        return json({
          ...mockPendingBusiness,
          status: 'Rejected',
          rejectionReason: reason,
        });
      }
      if (url.endsWith('/v1/merchants')) {
        return json([mockPendingBusiness]);
      }
      return undefined;
    });

    const rejectBtn = await screen.findByRole('button', { name: /^Reject$/i });
    await user.click(rejectBtn);

    expect(
      await screen.findByText(/Reject Merchant Application/i),
    ).toBeInTheDocument();

    const reasonInput = screen.getByLabelText(/Rejection Reason/i);
    fireEvent.change(reasonInput, {
      target: { value: 'Business registration certificate illegible.' },
    });

    const confirmReject = screen.getByRole('button', {
      name: /Confirm Rejection/i,
    });
    await user.click(confirmReject);

    await waitFor(() => {
      expect(rejectReason).toBe('Business registration certificate illegible.');
    });
  });

  it('suspends an approved merchant with a reason', async () => {
    const user = userEvent.setup();
    let suspendReason: string | null = null;

    setupMount('/admin/merchants', admin, (url, init) => {
      if (url.includes('/status') && init?.method === 'PUT') {
        const body = (
          typeof init.body === 'string'
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : {}
        ) as { reason?: string };
        const reason = body.reason ?? null;
        suspendReason = reason;
        return json({
          ...mockApprovedBusiness,
          status: 'Suspended',
          rejectionReason: reason,
        });
      }
      if (url.endsWith('/v1/merchants')) {
        return json([mockApprovedBusiness]);
      }
      return undefined;
    });

    const suspendBtn = await screen.findByRole('button', {
      name: /^Suspend$/i,
    });
    await user.click(suspendBtn);

    expect(
      await screen.findByText(/Suspend Merchant Account/i),
    ).toBeInTheDocument();

    const reasonInput = screen.getByLabelText(/Suspension Reason/i);
    fireEvent.change(reasonInput, {
      target: { value: 'Multiple parcel compliance flags reported.' },
    });

    const confirmSuspend = screen.getByRole('button', {
      name: /Confirm Suspension/i,
    });
    await user.click(confirmSuspend);

    await waitFor(() => {
      expect(suspendReason).toBe('Multiple parcel compliance flags reported.');
    });
  });
});
