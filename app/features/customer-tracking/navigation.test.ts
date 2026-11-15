import { describe, expect, it } from 'vitest';
import { deliveryReturnTo } from './navigation';

describe('delivery return navigation', () => {
  it.each([
    '/dashboard',
    '/customer/tracking',
    '/customer/history?status=Delivered&search=Perera&page=3&from=2026-11-01',
  ])('preserves the allowed origin and filters: %s', (origin) =>
    expect(deliveryReturnTo(origin)).toBe(origin),
  );
  it.each([
    undefined,
    null,
    '//evil.invalid',
    'https://evil.invalid',
    '/admin/users',
    '/customer/parcels/123',
    '/\\evil.invalid',
    { returnTo: '/dashboard' },
  ])('uses Delivery history for unsafe or missing origins: %s', (origin) =>
    expect(deliveryReturnTo(origin)).toBe('/customer/history'),
  );
});
