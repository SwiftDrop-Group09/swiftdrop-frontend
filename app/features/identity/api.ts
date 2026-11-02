import { z } from 'zod';
import {
  auditSchema,
  pageSchema,
  profileSchema,
  tokenSchema,
} from './contracts';
import type { AdminInput, ProfileInput } from './contracts';

export class IdentityError extends Error {
  constructor(
    readonly code: string,
    readonly status = 0,
  ) {
    super(messageFor(code));
  }
}
export function messageFor(code: string) {
  switch (code) {
    case 'invalid_credentials':
      return 'Sign-in failed or your session expired. Check your credentials and try again.';
    case 'account_link_required':
      return 'Sign in with your local password, then link Google from your profile.';
    case 'registration_conflict':
      return 'Registration could not be completed. Try signing in to your existing account.';
    case 'last_active_admin':
      return 'At least one active Admin must remain.';
    case 'account_conflict':
      return 'The account change conflicts with existing information. Reload the user list and review the account.';
    case 'not_found':
      return 'The account could not be found. Reload the user list.';
    case 'csrf_rejected':
      return 'Browser verification failed. Reload this page and try again.';
    case 'forbidden':
      return 'You do not have permission to perform this action.';
    case 'session_changed':
      return 'Your session changed. Please sign in again.';
    case 'invalid_input':
    case 'validation':
      return 'Check the supplied information and try again.';
    case 'google_unavailable':
      return 'Google sign-in is unavailable. You can use your local password.';
    case 'logout_unconfirmed':
      return 'Signed out on this page. Server logout could not be confirmed; close shared browser windows and try again when connected.';
    default:
      return 'The request could not be completed. Check your connection before trying again.';
  }
}
export async function responseFailure(response: Response) {
  let code =
    response.status === 403
      ? 'forbidden'
      : response.status === 401
        ? 'invalid_credentials'
        : 'request_failed';
  try {
    const value: unknown = await response.json();
    const parsed = z.object({ code: z.string() }).safeParse(value);
    if (parsed.success) code = parsed.data.code;
  } catch {
    /* Raw server responses and transport errors must not reach the UI. */
  }
  return new IdentityError(code, response.status);
}

export class IdentityApi {
  private csrfToken: string | null = null;
  private bootstrapFlight: Promise<{
    csrfToken: string;
    googleNonce: string;
  }> | null = null;
  readonly base: string;
  constructor(
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
    base = '/api',
  ) {
    // Browser sessions deliberately use the public same-origin gateway.
    if (!base.startsWith('/') || base.startsWith('//') || /[?#\\]/.test(base))
      throw new Error('Use a same-origin API path.');
    this.base = base.replace(/\/$/, '');
  }
  bootstrap(freshNonce = false) {
    if (freshNonce && this.bootstrapFlight) return this.bootstrapFlight;
    this.bootstrapFlight ??= this.send('/v1/auth/csrf')
      .then(async (response) => {
        const value = z
          .object({
            csrfToken: z.string().min(1),
            googleNonce: z.string().min(1),
          })
          .parse(await response.json());
        this.csrfToken = value.csrfToken;
        return value;
      })
      .finally(() => {
        this.bootstrapFlight = null;
      });
    return this.bootstrapFlight;
  }
  async send(
    path: string,
    method = 'GET',
    body?: unknown,
    accessToken?: string,
  ) {
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    if (serialized && new TextEncoder().encode(serialized).length > 16384)
      throw new IdentityError('invalid_input');
    if (method !== 'GET' && !this.csrfToken) await this.bootstrap();
    let response: Response;
    try {
      response = await this.fetcher(this.base + path, {
        method,
        credentials: 'include',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(method !== 'GET' ? { 'X-CSRF-Token': this.csrfToken! } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        ...(serialized !== undefined ? { body: serialized } : {}),
      });
    } catch {
      throw new IdentityError('network_error');
    }
    if (!response.ok) throw await responseFailure(response);
    return response;
  }
  async login(email: string, password: string) {
    return tokenSchema.parse(
      await (
        await this.send('/v1/auth/login', 'POST', { email, password })
      ).json(),
    );
  }
  async register(email: string, password: string, fullName: string) {
    return profileSchema.parse(
      await (
        await this.send('/v1/auth/register', 'POST', {
          email,
          password,
          fullName,
        })
      ).json(),
    );
  }
  async refresh() {
    return tokenSchema.parse(
      await (await this.send('/v1/auth/refresh', 'POST', {})).json(),
    );
  }
  async logout(token: string) {
    await this.send('/v1/auth/logout', 'POST', {}, token);
  }
  async google(idToken: string) {
    return tokenSchema.parse(
      await (await this.send('/v1/auth/google', 'POST', { idToken })).json(),
    );
  }
  async link(token: string, idToken: string, currentPassword: string) {
    return profileSchema.parse(
      await (
        await this.send(
          '/v1/auth/google/link',
          'POST',
          { idToken, currentPassword },
          token,
        )
      ).json(),
    );
  }
  async profile(token: string) {
    return profileSchema.parse(
      await (await this.send('/v1/users/me', 'GET', undefined, token)).json(),
    );
  }
  async updateProfile(
    token: string,
    { fullName, phoneNumber, address }: ProfileInput,
  ) {
    return profileSchema.parse(
      await (
        await this.send(
          '/v1/users/me',
          'PUT',
          { fullName, phoneNumber, address },
          token,
        )
      ).json(),
    );
  }
  async users(token: string, page: number) {
    return pageSchema(profileSchema).parse(
      await (
        await this.send(
          `/v1/users?page=${page}&pageSize=20`,
          'GET',
          undefined,
          token,
        )
      ).json(),
    );
  }
  async createUser(
    token: string,
    { email, fullName, isActive, password }: AdminInput & { password: string },
  ) {
    return profileSchema.parse(
      await (
        await this.send(
          '/v1/users',
          'POST',
          { email, fullName, isActive, password },
          token,
        )
      ).json(),
    );
  }
  async updateUser(
    token: string,
    id: string,
    { email, fullName, isActive }: AdminInput,
  ) {
    return profileSchema.parse(
      await (
        await this.send(
          `/v1/users/${encodeURIComponent(id)}`,
          'PUT',
          { email, fullName, isActive },
          token,
        )
      ).json(),
    );
  }
  async setRoles(token: string, id: string, roles: string[]) {
    return profileSchema.parse(
      await (
        await this.send(
          `/v1/users/${encodeURIComponent(id)}/roles`,
          'PUT',
          { roles },
          token,
        )
      ).json(),
    );
  }
  async deactivate(token: string, id: string) {
    await this.send(
      `/v1/users/${encodeURIComponent(id)}`,
      'DELETE',
      undefined,
      token,
    );
  }
  async audit(token: string, page: number) {
    return pageSchema(auditSchema).parse(
      await (
        await this.send(
          `/v1/audit-logs?page=${page}&pageSize=20`,
          'GET',
          undefined,
          token,
        )
      ).json(),
    );
  }
}
