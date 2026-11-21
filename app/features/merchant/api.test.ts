import { describe, expect, it, vi } from 'vitest';
import { MerchantApi, messageForMerchant } from './api';

const mockBusiness = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  businessName: 'ACME Supply',
  contactEmail: 'contact@acme.com',
  contactPhone: '0771234567',
  pickupAddress: '123 Market St, Colombo',
  status: 'Pending',
  rejectionReason: null,
  registeredAt: '2026-11-04T00:00:00Z',
  approvedAt: null,
  approvedBy: null,
};

const mockApiKey = {
  id: '33333333-3333-4333-8333-333333333333',
  businessId: '11111111-1111-4111-8111-111111111111',
  keyPrefix: 'swd_test_12345678',
  scopes: ['orders:read'],
  isActive: true,
  createdAt: '2026-11-04T00:00:00Z',
  revokedAt: null,
};

describe('MerchantApi client', () => {
  it('rejects cross-origin or non-relative base paths', () => {
    expect(() => new MerchantApi(vi.fn(), 'https://evil.com')).toThrow(
      'Use a same-origin API path.',
    );
    expect(() => new MerchantApi(vi.fn(), '//evil.com')).toThrow(
      'Use a same-origin API path.',
    );
  });

  it('registers a new merchant successfully', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockBusiness), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const api = new MerchantApi(fetcher);

    const result = await api.registerMerchant(
      {
        businessName: 'ACME Supply',
        contactEmail: 'contact@acme.com',
        contactPhone: '0771234567',
        pickupAddress: '123 Market St, Colombo',
      },
      'test-token',
    );

    expect(result.businessName).toBe('ACME Supply');
    expect(result.status).toBe('Pending');
    expect(fetcher.mock.calls[0]![0]).toBe('/api/v1/merchants/register');
    const options = fetcher.mock.calls[0]![1] as RequestInit;
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    });
  });

  it('returns null when getMyMerchant gets 404', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'business_not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );
    const api = new MerchantApi(fetcher);

    const result = await api.getMyMerchant('test-token');
    expect(result).toBeNull();
  });

  it('lists merchants for admin', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([mockBusiness]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const api = new MerchantApi(fetcher);

    const result = await api.listMerchants('admin-token');
    expect(result).toHaveLength(1);
    expect(result[0]?.businessName).toBe('ACME Supply');
  });

  it('updates merchant status', async () => {
    const approvedBusiness = { ...mockBusiness, status: 'Approved' };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(approvedBusiness), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const api = new MerchantApi(fetcher);

    const result = await api.setMerchantStatus(
      mockBusiness.id,
      { status: 'Approved' },
      'admin-token',
    );
    expect(result.status).toBe('Approved');
  });

  it('creates an API key and returns one-time plaintext key', async () => {
    const oneTimeResponse = {
      keyId: mockApiKey.id,
      apiKey: 'swd_test_12345678_secret',
      scopes: ['orders:read'],
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(oneTimeResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const api = new MerchantApi(fetcher);

    const result = await api.createApiKey({ scopes: ['orders:read'] }, 'token');
    expect(result.apiKey).toBe('swd_test_12345678_secret');
    expect(result.scopes).toContain('orders:read');
  });

  it('lists API keys without exposing secrets', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([mockApiKey]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const api = new MerchantApi(fetcher);

    const result = await api.listApiKeys('token');
    expect(result).toHaveLength(1);
    expect(result[0]?.keyPrefix).toBe('swd_test_12345678');
  });

  it('revokes an API key', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );
    const api = new MerchantApi(fetcher);

    await expect(
      api.revokeApiKey(mockApiKey.id, 'token'),
    ).resolves.toBeUndefined();
  });

  it('maps custom problem codes and field errors correctly', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'duplicate_business',
          title: 'You already have a registered business.',
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      ),
    );
    const api = new MerchantApi(fetcher);

    await expect(
      api.registerMerchant(
        {
          businessName: 'ACME',
          contactEmail: 'a@b.com',
          contactPhone: '077',
          pickupAddress: 'St',
        },
        'token',
      ),
    ).rejects.toThrow('You already have a registered business.');
  });

  it('provides readable messages for known merchant codes', () => {
    expect(messageForMerchant('duplicate_business')).toContain('registered');
    expect(messageForMerchant('business_not_approved')).toContain(
      'Only approved',
    );
    expect(messageForMerchant('api_key_not_found')).toContain('not found');
  });
});
