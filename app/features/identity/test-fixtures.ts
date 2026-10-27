import type { Profile, TokenPair } from './contracts';
export const customer: Profile = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'customer@example.test',
  fullName: 'Test Customer',
  phoneNumber: null,
  address: null,
  roles: ['Customer'],
  isActive: true,
};
export const admin: Profile = {
  ...customer,
  id: '00000000-0000-4000-8000-000000000002',
  email: 'admin@example.test',
  roles: ['Admin'],
};
export function pair(user = customer, accessToken = 'access-token'): TokenPair {
  return { accessToken, tokenType: 'Bearer', expiresInSeconds: 900, user };
}
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
export const csrf = {
  csrfToken: 'csrf-proof',
  googleNonce: 'server-google-nonce',
};
