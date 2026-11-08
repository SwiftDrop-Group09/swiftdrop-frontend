import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { IdentityApi } from './api';
import { AuthPage } from './auth-page';
import { ProfilePage } from './profile-page';
import { DashboardPage } from './dashboard-page';
import { AdminPage } from './admin-page';
import { SessionEntry } from './session-entry';
import { IdentityProvider, IdentitySession } from './session';
import type { Profile } from './contracts';
import { admin, csrf, customer, json, pair } from './test-fixtures';

type Route = (
  path: string,
  init: RequestInit | undefined,
) => Response | Promise<Response> | undefined;
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
    if (url.endsWith('/auth/methods'))
      return Promise.resolve(json({ hasPassword: true, googleLinked: false }));
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
      { path: '/', element: <SessionEntry /> },
      { path: '/signup', element: <SessionEntry register /> },
      { path: '/login', element: <AuthPage /> },
      { path: '/register', element: <AuthPage register /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/dashboard', element: <DashboardPage /> },
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
  it('waits for session restoration at root before opening the dashboard', async () => {
    let complete!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      complete = resolve;
    });
    const { router } = mount('/', undefined, (path) =>
      path.endsWith('/auth/refresh') ? response : undefined,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking your session',
    );
    expect(router.state.location.pathname).toBe('/');
    expect(
      screen.queryByRole('heading', { name: 'Welcome back' }),
    ).not.toBeInTheDocument();
    await act(async () => {
      complete(json(pair()));
      await response;
    });
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('redirects a signed-out root visit to login and links to signup', async () => {
    const { router, user } = mount('/');
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(router.state.location.pathname).toBe('/login');
    await user.click(screen.getByRole('link', { name: 'Create account' }));
    await screen.findByRole('heading', { name: 'Create your account' });
    expect(router.state.location.pathname).toBe('/register');
  });

  it('keeps sign-in usable when root session restoration fails', async () => {
    const { router } = mount('/', undefined, (path) =>
      path.endsWith('/auth/refresh')
        ? json({ code: 'unavailable' }, 503)
        : undefined,
    );
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('resolves the signup alias to registration for a signed-out visitor', async () => {
    const { router } = mount('/signup');
    await screen.findByRole('heading', { name: 'Create your account' });
    expect(router.state.location.pathname).toBe('/register');
  });

  it.each(['/login', '/register', '/signup'])(
    'redirects an authenticated %s visit to the dashboard',
    async (path) => {
      const { router } = mount(path, customer);
      await screen.findByRole('heading', { name: 'Dashboard' });
      expect(router.state.location.pathname).toBe('/dashboard');
      expect(
        screen.queryByRole('heading', { name: 'Create your account' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Welcome back' }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    { role: 'Customer' as const, groups: ['Workspace', 'Customer'] },
    { role: 'Courier' as const, groups: ['Workspace', 'Courier'] },
    { role: 'Merchant' as const, groups: ['Workspace', 'Merchant'] },
    { role: 'Dispatcher' as const, groups: ['Workspace', 'Dispatch'] },
    {
      role: 'Admin' as const,
      groups: ['Workspace', 'Dispatch', 'Administration'],
    },
  ])('shows the documented navigation for $role', async ({ role, groups }) => {
    mount('/dashboard', { ...customer, roles: [role] });
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(
      screen
        .getAllByRole('navigation')
        .map((nav) => nav.getAttribute('aria-label')),
    ).toEqual(groups.map((group) => `${group} navigation`));
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'My profile' })).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  it('keeps unimplemented screens disabled instead of linking to missing routes', async () => {
    const { user, router } = mount('/dashboard', customer);
    await screen.findByRole('heading', { name: 'Dashboard' });
    const navigation = within(
      screen.getByRole('navigation', { name: 'Customer navigation' }),
    );
    for (const label of [
      'Book a delivery',
      'Track a parcel',
      'Delivery history',
      'Receipts',
    ]) {
      const item = navigation.getByRole('button', { name: label });
      expect(item).toBeDisabled();
      expect(item).toHaveAccessibleDescription(
        'Items marked Soon will be available in a future update.',
      );
      await user.click(item);
      expect(router.state.location.pathname).toBe('/dashboard');
    }
    expect(navigation.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Business registration' }),
    ).toBeDisabled();
  });

  it('combines assigned roles without duplicating shared or dispatch navigation', async () => {
    mount('/dashboard', {
      ...customer,
      roles: ['Customer', 'Courier', 'Merchant', 'Dispatcher', 'Admin'],
    });
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getAllByRole('navigation')).toHaveLength(6);
    expect(screen.getAllByRole('link', { name: 'My profile' })).toHaveLength(1);
    expect(
      screen.getAllByRole('navigation', { name: 'Dispatch navigation' }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Business registration' }),
    ).toHaveLength(1);
  });

  it('updates navigation when the server profile changes roles', async () => {
    const { session } = mount('/dashboard', admin);
    await screen.findByRole('link', { name: 'User administration' });
    act(() => session.updateUser({ ...customer, roles: ['Courier'] }));
    expect(
      screen.queryByRole('navigation', { name: 'Administration navigation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Dispatch navigation' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Courier navigation' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'User administration' }),
    ).not.toBeInTheDocument();
  });

  it('opens the existing audit section and marks only the audit link active', async () => {
    const { user, router } = mount('/dashboard', admin);
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('link', { name: 'Audit logs' }));
    await screen.findByRole('heading', { name: 'Identity audit log' });
    expect(router.state.location).toMatchObject({
      pathname: '/admin/users',
      hash: '#identity-audit',
    });
    expect(screen.getByRole('link', { name: 'Audit logs' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: 'User administration' }),
    ).not.toHaveAttribute('aria-current');
    expect(
      screen.getByRole('button', { name: 'View audit log' }),
    ).toBeInTheDocument();
  });

  it('rejects mismatching confirmation before any registration request', async () => {
    const { user, fetcher } = mount('/register');
    const submit = screen.getByRole('button', {
      name: 'Create account',
    });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.type(screen.getByLabelText('Full name'), 'New Customer');
    await user.type(screen.getByLabelText('Email'), customer.email);
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'long-private-password',
    );
    await user.type(
      screen.getByLabelText('Confirm password'),
      'different-password',
    );
    await user.click(submit);
    expect(
      await screen.findByText('Passwords do not match.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toHaveFocus();
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).endsWith('/auth/register'),
      ),
    ).toBe(false);
  });
  it('creates an account, signs in once, and lands on the empty dashboard shell', async () => {
    const { user, fetcher, router } = mount('/register', undefined, (path) =>
      path.endsWith('/auth/register')
        ? json(customer, 201)
        : path.endsWith('/auth/login')
          ? json(pair())
          : undefined,
    );
    const submit = screen.getByRole('button', {
      name: 'Create account',
    });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.type(screen.getByLabelText('Full name'), 'New Customer');
    await user.type(screen.getByLabelText('Email'), customer.email);
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'long-private-password',
    );
    await user.type(
      screen.getByLabelText('Confirm password'),
      'long-private-password',
    );
    await user.click(submit);
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.getByLabelText('Dashboard workspace')).toBeEmptyDOMElement();
    const registration = fetcher.mock.calls.find((call) =>
      pathOf(call[0]).endsWith('/auth/register'),
    )!;
    expect(payload(registration[1])).toEqual({
      email: customer.email,
      fullName: 'New Customer',
      password: 'long-private-password',
    });
    expect(
      fetcher.mock.calls.filter((call) =>
        pathOf(call[0]).endsWith('/auth/login'),
      ),
    ).toHaveLength(1);
  });
  it('protects the dashboard and redirects a signed-out user to login', async () => {
    const { router } = mount('/dashboard');
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(router.state.location.pathname).toBe('/login');
    expect(
      screen.queryByLabelText('Dashboard workspace'),
    ).not.toBeInTheDocument();
  });
  it('shows real workspace links and supports keyboard sidebar toggling', async () => {
    const { user, router } = mount('/dashboard', admin);
    await screen.findByRole('heading', { name: 'Dashboard' });
    const sidebar = document.querySelector(
      '[data-slot="sidebar"][data-state]',
    )!;
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
    await user.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    await user.keyboard('{Control>}b{/Control}');
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
    await user.click(screen.getByRole('link', { name: 'My profile' }));
    await screen.findByRole('heading', { name: 'My profile' });
    expect(router.state.location.pathname).toBe('/profile');
  });

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
    await user.type(
      screen.getByLabelText('Confirm password'),
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
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
  it('toggles password visibility between password and plain text', async () => {
    const { user } = mount('/login');
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Hide password' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
  it('lets keyboard users reveal a password without submitting the form', async () => {
    const { user, fetcher } = mount('/login');
    const password = screen.getByLabelText('Password');
    await user.click(password);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(password).toHaveAttribute('type', 'text');
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).endsWith('/auth/login'),
      ),
    ).toBe(false);
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
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(screen.getByText(customer.fullName)).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard workspace')).toBeEmptyDOMElement();
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
    await user.type(screen.getByLabelText(/^Phone number/), '0771234567');
    await user.type(screen.getByLabelText(/^Address/), 'Colombo');
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

describe('Google SDK and explicit linking', () => {
  it('renders the provider inline without an application dialog or token exchange', async () => {
    const initialize = google();
    const { fetcher } = mount('/login');
    await screen.findByRole('button', { name: 'Google provider sign in' });
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).endsWith('/auth/google'),
      ),
    ).toBe(false);
  });
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
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
  });
  it('uses sign-up text on registration and sign-in text on login', async () => {
    const renderButton = vi.fn((element: HTMLElement) => {
      const button = document.createElement('button');
      button.textContent = 'Google provider sign in';
      element.replaceChildren(button);
    });
    vi.stubEnv(
      'VITE_GOOGLE_WEB_CLIENT_ID',
      'public-client.apps.googleusercontent.com',
    );
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn(),
          renderButton,
          cancel: vi.fn(),
          disableAutoSelect: vi.fn(),
        },
      },
    };

    const { router } = mount('/register');
    await screen.findByRole('button', { name: 'Google provider sign in' });
    expect(renderButton).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ text: 'signup_with' }),
    );
    await act(() => router.navigate('/login'));
    await screen.findAllByRole('button', { name: 'Google provider sign in' });
    expect(renderButton).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ text: 'signin_with' }),
    );
  });
  it('ignores a late Google callback after leaving the sign-in route', async () => {
    const initialize = google();
    const { router, fetcher } = mount('/login');
    await screen.findByRole('button', { name: 'Google provider sign in' });
    const callback = initialize.mock.calls[0]![0].callback;
    await act(() => router.navigate('/register'));
    await screen.findByRole('heading', { name: 'Create your account' });
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
    await user.click(
      await screen.findByRole('button', { name: 'Connect Google' }),
    );
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
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Google provider sign in' }),
      ).not.toBeInTheDocument(),
    );
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
    await user.click(
      await screen.findByRole('button', { name: 'Connect Google' }),
    );
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
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    const call = fetcher.mock.calls.find((value) =>
      pathOf(value[0]).endsWith('/auth/google/link'),
    )!;
    expect(payload(call[1])).toEqual({
      idToken: 'sdk-signed-id-token',
      currentPassword: 'fresh-local-password',
    });
  });
});

describe('Profile settings and sign-in connections', () => {
  it.each(['Customer', 'Courier', 'Merchant', 'Dispatcher', 'Admin'] as const)(
    'shows %s access without offering self role changes',
    async (role) => {
      const account = { ...customer, roles: [role] };
      mount('/profile', account);
      await screen.findByDisplayValue(customer.fullName);
      expect(
        within(screen.getByLabelText('Assigned roles')).getByText(role),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toHaveAttribute(
        'readonly',
      );
      expect(
        screen.queryByRole('checkbox', { name: role }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Manage users and roles' }) !== null,
      ).toBe(role === 'Admin');
    },
  );

  it('resets edits and uses normalized saved values as the new clean state', async () => {
    const { user, session } = mount('/profile', customer, (path, init) =>
      path.endsWith('/users/me') && init?.method === 'PUT'
        ? json({ ...customer, fullName: 'Saved Customer' })
        : undefined,
    );
    const name = await screen.findByDisplayValue(customer.fullName);
    const save = screen.getByRole('button', { name: 'Save profile' });
    expect(save).toBeDisabled();
    await user.clear(name);
    await user.type(name, 'Discard me');
    await user.click(screen.getByRole('button', { name: 'Reset changes' }));
    expect(name).toHaveValue(customer.fullName);
    expect(save).toBeDisabled();
    await user.clear(name);
    await user.type(name, 'Saved Customer ');
    await user.click(save);
    await screen.findByText('Your profile was saved.');
    expect(name).toHaveValue('Saved Customer');
    expect(save).toBeDisabled();
    expect(session.getSnapshot().user?.fullName).toBe('Saved Customer');
  });

  it('shows both confirmed sign-in methods without a redundant connection form', async () => {
    mount('/profile', customer, (path) =>
      path.endsWith('/auth/methods')
        ? json({ hasPassword: true, googleLinked: true })
        : undefined,
    );
    await screen.findByText('Your Google account is connected.');
    expect(
      screen.getByText('Password sign-in is enabled.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Connect Google' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add password' }),
    ).not.toBeInTheDocument();
  });

  it('fails closed when method metadata is unavailable and offers a real retry', async () => {
    let unavailable = true;
    const { user, fetcher } = mount('/profile', customer, (path) =>
      path.endsWith('/auth/methods')
        ? unavailable
          ? json({ code: 'unavailable' }, 503)
          : json({ hasPassword: false, googleLinked: true })
        : undefined,
    );
    await screen.findByText(
      'Sign-in methods could not be loaded. Please try again.',
    );
    expect(
      screen.queryByRole('button', { name: 'Connect Google' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add password' }),
    ).not.toBeInTheDocument();
    unavailable = false;
    await user.click(
      screen.getByRole('button', { name: 'Retry sign-in methods' }),
    );
    await screen.findByRole('button', { name: 'Add password' });
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).endsWith('/auth/password'),
      ),
    ).toBe(false);
  });

  it('validates a new password before Google confirmation and sends only the credential contract', async () => {
    const initialize = google();
    let methods = { hasPassword: false, googleLinked: true };
    const { user, fetcher, queries } = mount('/profile', customer, (path) => {
      if (path.endsWith('/auth/methods')) return json(methods);
      if (path.endsWith('/auth/password')) {
        methods = { hasPassword: true, googleLinked: true };
        return json(methods);
      }
      return undefined;
    });
    await user.click(
      await screen.findByRole('button', { name: 'Add password' }),
    );
    await user.type(
      screen.getByLabelText('New password', { exact: true }),
      'private-new-password',
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'different-password',
    );
    await user.click(
      screen.getByRole('button', { name: 'Continue to Google confirmation' }),
    );
    await screen.findByText('Passwords do not match.');
    expect(screen.getByLabelText('Confirm new password')).toHaveFocus();
    expect(initialize).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'private-new-password',
    );
    await user.click(
      screen.getByRole('button', { name: 'Continue to Google confirmation' }),
    );
    const provider = await screen.findByRole('button', {
      name: 'Google provider sign in',
    });
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).endsWith('/auth/password'),
      ),
    ).toBe(false);
    await user.click(provider);
    await screen.findByText(
      'Password sign-in is now enabled. You can use either method.',
    );
    expect(
      screen.getByText('Password sign-in is enabled.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    const writes = fetcher.mock.calls.filter((call) =>
      pathOf(call[0]).endsWith('/auth/password'),
    );
    expect(writes).toHaveLength(1);
    expect(payload(writes[0]![1])).toEqual({
      idToken: 'sdk-signed-id-token',
      password: 'private-new-password',
    });
    const cached = JSON.stringify(
      queries
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
    );
    expect(cached).not.toContain('private-new-password');
    expect(cached).not.toContain('sdk-signed-id-token');
    expect(queries.getMutationCache().getAll()).toHaveLength(0);
  });

  it('cancels adding a password without writing and clears private form values', async () => {
    google();
    const { user, fetcher } = mount('/profile', customer, (path) =>
      path.endsWith('/auth/methods')
        ? json({ hasPassword: false, googleLinked: true })
        : undefined,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Add password' }),
    );
    await user.type(
      screen.getByLabelText('New password', { exact: true }),
      'private-new-password',
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'private-new-password',
    );
    await user.click(
      screen.getByRole('button', { name: 'Continue to Google confirmation' }),
    );
    await screen.findByRole('button', { name: 'Google provider sign in' });
    await user.click(screen.getByRole('button', { name: 'Cancel connecting' }));
    await user.click(screen.getByRole('button', { name: 'Add password' }));
    expect(screen.getByLabelText('New password', { exact: true })).toHaveValue(
      '',
    );
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).endsWith('/auth/password'),
      ),
    ).toBe(false);
  });

  it('preserves the signed-in session and clears new passwords after rejected Google confirmation', async () => {
    google();
    const { user, session, fetcher } = mount('/profile', customer, (path) =>
      path.endsWith('/auth/methods')
        ? json({ hasPassword: false, googleLinked: true })
        : path.endsWith('/auth/password')
          ? json({ code: 'invalid_credentials' }, 401)
          : undefined,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Add password' }),
    );
    await user.type(
      screen.getByLabelText('New password', { exact: true }),
      'private-new-password',
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'private-new-password',
    );
    await user.click(
      screen.getByRole('button', { name: 'Continue to Google confirmation' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Google provider sign in' }),
    );
    await screen.findByText(/Sign-in failed or your session expired/);
    expect(session.getSnapshot().user).toEqual(customer);
    expect(screen.getByLabelText('New password', { exact: true })).toHaveValue(
      '',
    );
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
    expect(
      fetcher.mock.calls.filter((call) =>
        pathOf(call[0]).endsWith('/auth/password'),
      ),
    ).toHaveLength(1);
  });

  it('does not sign the user out when Google linking rejects a different email', async () => {
    google();
    const { user, session } = mount('/profile', customer, (path) =>
      path.endsWith('/auth/google/link')
        ? json({ code: 'account_link_rejected' }, 403)
        : undefined,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Connect Google' }),
    );
    await user.type(
      screen.getByLabelText('Current password'),
      'private-local-password',
    );
    await user.click(
      await screen.findByRole('button', { name: 'Google provider sign in' }),
    );
    await screen.findByText(
      'Choose the Google account with the same verified email as your SwiftDrop account.',
    );
    expect(session.getSnapshot().user).toEqual(customer);
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('reads confirmed connected status after linking Google', async () => {
    google();
    let linked = false;
    const { user } = mount('/profile', customer, (path) => {
      if (path.endsWith('/auth/methods'))
        return json({ hasPassword: true, googleLinked: linked });
      if (path.endsWith('/auth/google/link')) {
        linked = true;
        return json(customer);
      }
      return undefined;
    });
    await user.click(
      await screen.findByRole('button', { name: 'Connect Google' }),
    );
    await user.type(
      screen.getByLabelText('Current password'),
      'private-local-password',
    );
    await user.click(
      await screen.findByRole('button', { name: 'Google provider sign in' }),
    );
    await screen.findByText('Your Google account is connected.');
    expect(
      screen.queryByRole('button', { name: 'Connect Google' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
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
  it('invalidates reviewed account details when the shadcn active checkbox changes', async () => {
    const { user, fetcher } = mount('/admin/users', admin);
    await user.click(
      await screen.findByRole('button', { name: `Edit ${customer.email}` }),
    );
    const editor = within(section(`Edit ${customer.fullName}`));
    await user.click(
      editor.getByRole('button', { name: 'Review account change' }),
    );
    expect(
      editor.getByRole('button', { name: 'Confirm change' }),
    ).toBeInTheDocument();
    const active = editor.getByRole('checkbox', { name: 'Account active' });
    await user.click(active);
    expect(active).not.toBeChecked();
    expect(
      editor.queryByRole('button', { name: 'Confirm change' }),
    ).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(
      false,
    );
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
