import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { IdentityApi } from './api';
import { AuthPage } from './auth-page';
import { ProfilePage } from './profile-page';
import { AdminPage } from './admin-page';
import { IdentityProvider, IdentitySession } from './session';
import type { Profile } from './contracts';
import { admin, csrf, customer, json, pair } from './test-fixtures';

type Route = (
  path: string,
  init: RequestInit | undefined,
) => Response | undefined;
function pathOf(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}
function payload(init?: RequestInit): unknown {
  return typeof init?.body === 'string'
    ? (JSON.parse(init.body) as unknown)
    : null;
}
function mount(path: string, signedIn?: Profile, override?: Route) {
  const fetcher = vi.fn<typeof fetch>((input, init) => {
    const url = pathOf(input);
    const replacement = override?.(url, init);
    if (replacement) return Promise.resolve(replacement);
    if (url.endsWith('/auth/csrf')) return Promise.resolve(json(csrf));
    if (url.endsWith('/auth/refresh'))
      return Promise.resolve(
        signedIn
          ? json(pair(signedIn))
          : json({ code: 'invalid_credentials' }, 401),
      );
    if (url.endsWith('/users/me'))
      return Promise.resolve(json(signedIn ?? customer));
    if (url.startsWith('/api/v1/users?'))
      return Promise.resolve(
        json({
          items: [admin, customer],
          totalCount: 2,
          page: 1,
          pageSize: 20,
        }),
      );
    return Promise.resolve(json({ code: 'validation' }, 400));
  });
  const api = new IdentityApi(fetcher);
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const session = new IdentitySession(api, () => queries.clear());
  const router = createMemoryRouter(
    [
      { path: '/login', element: <AuthPage /> },
      { path: '/register', element: <AuthPage register /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/admin/users', element: <AdminPage /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queries}>
      <IdentityProvider session={session}>
        <RouterProvider router={router} />
      </IdentityProvider>
    </QueryClientProvider>,
  );
  return { fetcher, api, session, queries, router, user: userEvent.setup() };
}
function section(heading: string) {
  return screen.getByRole('heading', { name: heading }).closest('section')!;
}
beforeEach(() => vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', ''));
afterEach(() => {
  vi.unstubAllEnvs();
  delete window.google;
});

describe('Customer account screens', () => {
  it('validates registration before submission and sends only Customer registration fields', async () => {
    const { user, fetcher } = mount('/register', undefined, (path) =>
      path.endsWith('/auth/register') ? json(customer, 201) : undefined,
    );
    const submit = await screen.findByRole('button', {
      name: 'Create account',
    });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(
      fetcher.mock.calls.filter((call) =>
        pathOf(call[0]).endsWith('/auth/register'),
      ),
    ).toHaveLength(0);
    await user.type(screen.getByLabelText(/^Full name/), 'New Customer');
    await user.type(screen.getByLabelText(/^Email/), customer.email);
    await user.type(
      screen.getByLabelText(/^Password/),
      'long-private-password',
    );
    await user.click(submit);
    expect(
      await screen.findByText('Your account was created.', { exact: false }),
    ).toBeInTheDocument();
    const call = fetcher.mock.calls.find((value) =>
      pathOf(value[0]).endsWith('/auth/register'),
    )!;
    expect(payload(call[1])).toEqual({
      email: customer.email,
      password: 'long-private-password',
      fullName: 'New Customer',
    });
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });
  it('presents generic login errors and clears the password', async () => {
    const { user } = mount('/login', undefined, (path) =>
      path.endsWith('/auth/login')
        ? json(
            {
              code: 'invalid_credentials',
              detail: 'sensitive database contents',
            },
            401,
          )
        : undefined,
    );
    const submit = await screen.findByRole('button', { name: 'Sign in' });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.type(screen.getByLabelText('Email'), customer.email);
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign-in failed',
    );
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(
      screen.queryByText('sensitive database contents'),
    ).not.toBeInTheDocument();
  });
  it('signs in and shows the server profile', async () => {
    const { user } = mount('/login', undefined, (path) =>
      path.endsWith('/auth/login') ? json(pair()) : undefined,
    );
    const submit = await screen.findByRole('button', { name: 'Sign in' });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.type(screen.getByLabelText('Email'), customer.email);
    await user.type(screen.getByLabelText('Password'), 'private-password');
    await user.click(submit);
    expect(
      await screen.findByRole('heading', { name: 'My profile' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByDisplayValue(customer.fullName),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'User administration' }),
    ).not.toBeInTheDocument();
  });
  it('edits only the documented self-profile fields', async () => {
    const { user, fetcher } = mount('/profile', customer, (path, init) =>
      path.endsWith('/users/me') && init?.method === 'PUT'
        ? json({
            ...customer,
            fullName: 'Changed Customer',
            phoneNumber: '0771234567',
            address: 'Colombo',
          })
        : undefined,
    );
    const name = await screen.findByDisplayValue(customer.fullName);
    await user.clear(name);
    await user.type(name, 'Changed Customer');
    await user.type(screen.getByLabelText('Phone number'), '0771234567');
    await user.type(screen.getByLabelText('Address'), 'Colombo');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your profile was saved',
    );
    const call = fetcher.mock.calls.find(
      (value) =>
        pathOf(value[0]).endsWith('/users/me') && value[1]?.method === 'PUT',
    )!;
    expect(payload(call[1])).toEqual({
      fullName: 'Changed Customer',
      phoneNumber: '0771234567',
      address: 'Colombo',
    });
  });
  it('handles failed restoration with a sign-in route rather than a fake identity', async () => {
    mount('/profile');
    expect(
      await screen.findByRole('heading', { name: 'Welcome back' }),
    ).toBeInTheDocument();
  });
  it('signs out and removes private cached data', async () => {
    const { user, queries, session } = mount('/profile', customer, (path) =>
      path.endsWith('/auth/logout')
        ? new Response(null, { status: 204 })
        : undefined,
    );
    await screen.findByDisplayValue(customer.fullName);
    queries.setQueryData(['private-parcels'], ['secret']);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(
      await screen.findByRole('heading', { name: 'Welcome back' }),
    ).toBeInTheDocument();
    expect(session.getSnapshot().user).toBeNull();
    expect(queries.getQueryData(['private-parcels'])).toBeUndefined();
  });
  it('shows unconfirmed server logout instead of claiming successful revocation', async () => {
    const { user } = mount('/profile', customer);
    await screen.findByDisplayValue(customer.fullName);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Server logout could not be confirmed',
    );
  });
});

describe('Google SDK and explicit linking', () => {
  function google() {
    vi.stubEnv(
      'VITE_GOOGLE_WEB_CLIENT_ID',
      'public-client.apps.googleusercontent.com',
    );
    let callback: (response: { credential?: string }) => void = () => {};
    const initialize = vi.fn<
      (
        options: Parameters<
          NonNullable<Window['google']>['accounts']['id']['initialize']
        >[0],
      ) => void
    >((options) => {
      callback = options.callback;
    });
    window.google = {
      accounts: {
        id: {
          initialize,
          renderButton: (element) => {
            const button = document.createElement('button');
            button.textContent = 'Google provider sign in';
            button.onclick = () =>
              callback({ credential: 'sdk-signed-id-token' });
            element.replaceChildren(button);
          },
          cancel: vi.fn(),
          disableAutoSelect: vi.fn(),
        },
      },
    };
    return initialize;
  }
  it('renews a rejected or expired nonce before retrying SDK sign-in', async () => {
    const initialize = google();
    let bootstraps = 0;
    let attempts = 0;
    const { user } = mount('/login', undefined, (path) => {
      if (path.endsWith('/auth/csrf'))
        return json({ ...csrf, googleNonce: `nonce-${++bootstraps}` });
      if (path.endsWith('/auth/google'))
        return ++attempts === 1
          ? json({ code: 'invalid_credentials' }, 401)
          : json(pair());
      return undefined;
    });
    await user.click(
      await screen.findByRole('button', { name: 'Google provider sign in' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign-in failed',
    );
    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(2));
    const nonceBefore = initialize.mock.calls[0]![0].nonce;
    const nonceAfter = initialize.mock.calls[1]![0].nonce;
    expect(nonceAfter).not.toBe(nonceBefore);
    await user.click(
      screen.getByRole('button', { name: 'Google provider sign in' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'My profile' }),
    ).toBeInTheDocument();
  });
  it('ignores a late Google callback after leaving the sign-in route', async () => {
    const initialize = google();
    const { router, fetcher } = mount('/login');
    await screen.findByRole('button', { name: 'Google provider sign in' });
    const callback = initialize.mock.calls[0]![0].callback;
    await act(() => router.navigate('/register'));
    await screen.findByRole('heading', { name: 'Create a Customer account' });
    callback({ credential: 'late-google-token' });
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).endsWith('/auth/google'),
      ),
    ).toBe(false);
  });
  it('retains the local session when fresh Google-link password verification fails', async () => {
    google();
    const { user, session } = mount('/profile', customer, (path) =>
      path.endsWith('/auth/google/link')
        ? json({ code: 'invalid_credentials' }, 401)
        : undefined,
    );
    await screen.findByDisplayValue(customer.fullName);
    await user.type(
      screen.getByLabelText('Current password'),
      'wrong-local-password',
    );
    await user.click(
      await screen.findByRole('button', { name: 'Google provider sign in' }),
    );
    expect(
      await screen.findByText(/Sign-in failed or your session expired/),
    ).toBeInTheDocument();
    expect(session.getSnapshot().user).toEqual(customer);
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });
  it('uses configured SDK client and server nonce, handles account-link-required without a session', async () => {
    const initialize = google();
    const { user, session, fetcher } = mount('/login', undefined, (path) =>
      path.endsWith('/auth/google')
        ? json({ code: 'account_link_required' }, 409)
        : undefined,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Google provider sign in' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'link Google from your profile',
    );
    expect(session.getSnapshot().user).toBeNull();
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'public-client.apps.googleusercontent.com',
        nonce: csrf.googleNonce,
        auto_select: false,
        ux_mode: 'popup',
      }),
    );
    const call = fetcher.mock.calls.find((value) =>
      pathOf(value[0]).endsWith('/auth/google'),
    )!;
    expect(payload(call[1])).toEqual({
      idToken: 'sdk-signed-id-token',
    });
    expect(
      screen.queryByDisplayValue('sdk-signed-id-token'),
    ).not.toBeInTheDocument();
  });
  it('does not submit any Google token when the SDK flow is cancelled', async () => {
    google();
    const { fetcher } = mount('/login');
    await screen.findByRole('button', { name: 'Google provider sign in' });
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).endsWith('/auth/google'),
      ),
    ).toBe(false);
  });
  it('requires the current local password for linking and clears it after use', async () => {
    google();
    const { user, fetcher } = mount('/profile', customer, (path) =>
      path.endsWith('/auth/google/link') ? json(customer) : undefined,
    );
    await screen.findByDisplayValue(customer.fullName);
    expect(
      screen.queryByRole('button', { name: 'Google provider sign in' }),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText('Current password'),
      'fresh-local-password',
    );
    await user.click(
      await screen.findByRole('button', { name: 'Google provider sign in' }),
    );
    expect(
      await screen.findByText('Google was linked to your account.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    const call = fetcher.mock.calls.find((value) =>
      pathOf(value[0]).endsWith('/auth/google/link'),
    )!;
    expect(payload(call[1])).toEqual({
      idToken: 'sdk-signed-id-token',
      currentPassword: 'fresh-local-password',
    });
  });
});

describe('Admin controls', () => {
  it('denies Admin navigation and API access for a Customer', async () => {
    const { fetcher } = mount('/admin/users', customer);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'do not have permission',
    );
    expect(
      fetcher.mock.calls.some((value) =>
        pathOf(value[0]).startsWith('/api/v1/users?'),
      ),
    ).toBe(false);
    expect(
      screen.queryByRole('link', { name: 'User administration' }),
    ).not.toBeInTheDocument();
  });
  it('requires confirmation for roles, preserves state on last-Admin rejection', async () => {
    const { user, fetcher } = mount('/admin/users', admin, (path, init) =>
      path.endsWith(`/${admin.id}/roles`) && init?.method === 'PUT'
        ? json({ code: 'last_active_admin' }, 409)
        : undefined,
    );
    await user.click(
      await screen.findByRole('button', { name: `Edit ${admin.email}` }),
    );
    const editor = within(section(`Edit ${admin.fullName}`));
    await user.click(editor.getByLabelText('Admin'));
    await user.click(
      editor.getByRole('button', { name: 'Review role changes' }),
    );
    expect(
      fetcher.mock.calls.some((value) => pathOf(value[0]).endsWith('/roles')),
    ).toBe(false);
    await user.click(editor.getByRole('button', { name: 'Confirm change' }));
    expect(await editor.findByRole('alert')).toHaveTextContent(
      'At least one active Admin must remain',
    );
    expect(
      screen.getByRole('link', { name: 'User administration' }),
    ).toBeInTheDocument();
    const call = fetcher.mock.calls.find((value) =>
      pathOf(value[0]).endsWith('/roles'),
    )!;
    expect(payload(call[1])).toEqual({ roles: [] });
  });
  it('cancels deactivation without a mutation', async () => {
    const { user, fetcher } = mount('/admin/users', admin);
    await user.click(
      await screen.findByRole('button', { name: `Edit ${customer.email}` }),
    );
    const editor = within(section(`Edit ${customer.fullName}`));
    await user.click(
      editor.getByRole('button', { name: 'Deactivate account' }),
    );
    expect(
      editor.getByText(/Existing access tokens may remain valid/),
    ).toBeInTheDocument();
    await user.click(editor.getByRole('button', { name: 'Cancel' }));
    expect(
      fetcher.mock.calls.some((value) => value[1]?.method === 'DELETE'),
    ).toBe(false);
  });
  it('updates the deactivated account after server confirmation', async () => {
    const { user } = mount('/admin/users', admin, (path, init) =>
      path.endsWith(`/${customer.id}`) && init?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : undefined,
    );
    await user.click(
      await screen.findByRole('button', { name: `Edit ${customer.email}` }),
    );
    const editor = within(section(`Edit ${customer.fullName}`));
    await user.click(
      editor.getByRole('button', { name: 'Deactivate account' }),
    );
    await user.click(editor.getByRole('button', { name: 'Confirm change' }));
    expect(
      await editor.findByText('Account change saved.'),
    ).toBeInTheDocument();
    expect(
      editor.getByRole('button', { name: 'Deactivate account' }),
    ).toBeDisabled();
  });
  it('generates and sends the approved create-only password only after confirmation', async () => {
    const created = {
      ...customer,
      id: '00000000-0000-4000-8000-000000000003',
      email: 'created@example.test',
      fullName: 'Created User',
    };
    const { user, fetcher, queries } = mount(
      '/admin/users',
      admin,
      (path, init) =>
        path === '/api/v1/users' && init?.method === 'POST'
          ? json(created, 201)
          : undefined,
    );
    await screen.findByRole('heading', { name: 'Create user account' });
    const form = within(section('Create user account'));
    await user.type(form.getByLabelText('Email'), created.email);
    await user.type(form.getByLabelText('Full name'), created.fullName);
    await user.click(form.getByRole('button', { name: 'Generate password' }));
    await user.click(form.getByRole('button', { name: 'Show password' }));
    const password =
      form.getByLabelText<HTMLInputElement>('Initial password').value;
    expect(password).toHaveLength(32);
    await user.click(form.getByRole('button', { name: 'Review new account' }));
    expect(
      fetcher.mock.calls.some(
        (value) => value[1]?.method === 'POST' && value[0] === '/api/v1/users',
      ),
    ).toBe(false);
    await user.click(
      form.getByRole('button', { name: 'Confirm create account' }),
    );
    expect(await form.findByText(/Account created/)).toBeInTheDocument();
    expect(form.getByLabelText('Initial password')).toHaveValue('');
    const call = fetcher.mock.calls.find(
      (value) => value[1]?.method === 'POST' && value[0] === '/api/v1/users',
    )!;
    expect(payload(call[1])).toEqual({
      email: created.email,
      fullName: created.fullName,
      isActive: true,
      password,
    });
    expect(
      JSON.stringify(
        queries
          .getMutationCache()
          .getAll()
          .map((value) => value.state.variables),
      ),
    ).not.toContain(password);
  });
  it('loads safe audit records with canonical paging', async () => {
    const { user, fetcher } = mount('/admin/users', admin, (path) =>
      path.startsWith('/api/v1/audit-logs?')
        ? json({
            items: [
              {
                id: 1,
                actorId: admin.id,
                action: 'RolesChanged',
                resourceId: customer.id,
                timestamp: '2026-10-26T00:00:00Z',
                resultCode: 'success',
              },
            ],
            totalCount: 21,
            page: path.includes('page=2') ? 2 : 1,
            pageSize: 20,
          })
        : undefined,
    );
    await user.click(
      await screen.findByRole('button', { name: 'View audit log' }),
    );
    expect(await screen.findByText('RolesChanged')).toBeInTheDocument();
    const audit = within(section('Identity audit log'));
    await user.click(audit.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          (value) => value[0] === '/api/v1/audit-logs?page=2&pageSize=20',
        ),
      ).toBe(true),
    );
  });
});
