import { AuditPage } from '~/features/audit/audit-page';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { IdentityApi } from './api';
import { AuthPage } from './auth-page';
import { ProfilePage } from './profile-page';
import { DashboardPage } from './dashboard-page';
import { AccessPage } from './access-page';
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
    if (url.startsWith('/api/v1/users?')) {
      const query = new URL(url, 'http://localhost').searchParams;
      const items = [admin, customer].filter(
        (item) =>
          (!query.get('role') ||
            item.roles.includes(
              query.get('role') as Profile['roles'][number],
            )) &&
          (!query.get('search') ||
            (item.fullName + item.email)
              .toLowerCase()
              .includes(query.get('search')!.toLowerCase())) &&
          (!query.get('status') ||
            item.isActive === (query.get('status') === 'active')),
      );
      return Promise.resolve(
        json({
          items,
          totalCount: items.length,
          page: Number(query.get('page')),
          pageSize: 20,
        }),
      );
    }
    if (url.includes('/audit-logs'))
      return Promise.resolve(
        json({
          items: [],
          totalCount: 0,
          hasMore: false,
          recordingEnabled: true,
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
      { path: '/401', element: <AccessPage status={401} /> },
      { path: '/403', element: <AccessPage status={403} /> },
      { path: '/register', element: <AuthPage register /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/admin/users', element: <AdminPage /> },
      { path: '/admin/audit', element: <AuditPage /> },
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
      'Getting your workspace ready',
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
    const { user } = mount('/dashboard', { ...customer, roles: [role] });
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
    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    expect(
      screen.getByRole('menuitem', { name: 'My profile' }),
    ).toHaveAttribute('href', '/profile');
  });

  it.each(['Dispatcher', 'Admin'] as const)(
    'links both implemented dispatch features for %s',
    async (role) => {
      mount('/dashboard', {
        ...customer,
        roles: [role],
      });
      await screen.findByRole('heading', { name: 'Dashboard' });
      const dispatchNav = within(
        screen.getByRole('navigation', { name: 'Dispatch navigation' }),
      );
      expect(
        dispatchNav.getByRole('link', { name: 'Courier workload' }),
      ).toHaveAttribute('href', '/dispatch/workload');
      expect(
        dispatchNav.getByRole('link', { name: 'Unassigned parcels' }),
      ).toHaveAttribute('href', '/dispatch/unassigned');
      expect(
        dispatchNav.getByRole('link', { name: 'Zone summary' }),
      ).toHaveAttribute('href', '/dispatch/zones');
      expect(
        screen.queryByRole('navigation', { name: 'Customer navigation' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Business registration' }),
      ).not.toBeInTheDocument();
    },
  );

  it('rejects ambiguous multi-role profiles before restoring private navigation', async () => {
    mount('/dashboard', { ...customer, roles: ['Customer', 'Admin'] });
    expect(
      await screen.findByRole('heading', { name: 'Sign in to continue' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Administration navigation' }),
    ).not.toBeInTheDocument();
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

  it('opens the dedicated audit page and marks only the audit link active', async () => {
    const { user, router } = mount('/dashboard', admin);
    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('link', { name: 'Audit logs' }));
    await screen.findByRole('heading', { name: 'Audit log' });
    expect(router.state.location).toMatchObject({
      pathname: '/admin/audit',
      hash: '',
    });
    expect(screen.getByRole('link', { name: 'Audit logs' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: 'User administration' }),
    ).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
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
  it('creates an account, signs in once, and lands on the role-aware dashboard', async () => {
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
    expect(
      within(screen.getByLabelText('Dashboard workspace')).getByRole('link', {
        name: 'Open Book a delivery',
      }),
    ).toHaveAttribute('href', '/customer/book');
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
  it('protects the dashboard and shows a 401 page with a sign-in link', async () => {
    const { router } = mount('/dashboard');
    await screen.findByRole('heading', { name: 'Sign in to continue' });
    expect(router.state.location.pathname).toBe('/401');
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
    const accountMenu = screen.getByRole('button', {
      name: 'Open account menu',
    });
    expect(
      screen.queryByRole('menuitem', { name: 'My profile' }),
    ).not.toBeInTheDocument();
    accountMenu.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'My profile' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(accountMenu).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('menuitem', { name: 'My profile' }));
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
    expect(
      within(screen.getByLabelText('Dashboard workspace')).getByRole('link', {
        name: 'Open Book a delivery',
      }),
    ).toHaveAttribute('href', '/customer/book');
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
      await screen.findByRole('heading', { name: 'Sign in to continue' }),
    ).toBeInTheDocument();
  });
  it('signs out and removes private cached data', async () => {
    const { user, queries, session, router } = mount(
      '/profile',
      customer,
      (path) =>
        path.endsWith('/auth/logout')
          ? new Response(null, { status: 204 })
          : undefined,
    );
    await screen.findByDisplayValue(customer.fullName);
    const visited: string[] = [];
    const unsubscribe = router.subscribe((state) =>
      visited.push(state.location.pathname),
    );
    queries.setQueryData(['private-parcels'], ['secret']);
    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(
      await screen.findByRole('heading', { name: 'Welcome back' }),
    ).toBeInTheDocument();
    expect(session.getSnapshot().user).toBeNull();
    expect(queries.getQueryData(['private-parcels'])).toBeUndefined();
    expect(visited).not.toContain('/401');
    expect(router.state.location.pathname).toBe('/login');
    unsubscribe();
  });
  it('shows unconfirmed server logout instead of claiming successful revocation', async () => {
    const { user } = mount('/profile', customer);
    await screen.findByDisplayValue(customer.fullName);
    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
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
  it('reports a Google dependency outage without blaming credentials or replaying the login', async () => {
    const initialize = google();
    let available = false;
    const { user, fetcher, session } = mount('/login', undefined, (path) => {
      if (path.endsWith('/auth/google'))
        return available
          ? json(pair())
          : json({ code: 'google_unavailable' }, 503);
      return undefined;
    });
    await user.click(
      await screen.findByRole('button', { name: 'Google provider sign in' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Google sign-in is unavailable. Please try again later.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      'Check your credentials',
    );
    expect(session.getSnapshot().user).toBeNull();
    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(2));
    expect(
      fetcher.mock.calls.filter(([input]) =>
        pathOf(input).endsWith('/auth/google'),
      ),
    ).toHaveLength(1);
    available = true;
    await user.click(
      await screen.findByRole('button', { name: 'Google provider sign in' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument();
    expect(
      fetcher.mock.calls.filter(([input]) =>
        pathOf(input).endsWith('/auth/google'),
      ),
    ).toHaveLength(2);
  });
  it.each([
    ['audit_unavailable', 503, 'Account services are temporarily unavailable.'],
    ['csrf_rejected', 403, 'Browser verification failed.'],
  ])(
    'preserves the %s bootstrap error and renews the nonce on retry',
    async (code, status, message) => {
      const initialize = google();
      let available = false;
      const { user, fetcher } = mount('/login', undefined, (path) => {
        if (path.endsWith('/auth/csrf') && !available)
          return json({ code, detail: 'private backend details' }, status);
        return undefined;
      });
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.getByRole('alert')).not.toHaveTextContent(
        'Google sign-in could not load',
      );
      expect(screen.getByRole('alert')).not.toHaveTextContent(
        'private backend details',
      );
      expect(initialize).not.toHaveBeenCalled();
      available = true;
      await user.click(
        screen.getByRole('button', { name: 'Retry Google sign-in' }),
      );
      await screen.findByRole('button', { name: 'Google provider sign in' });
      expect(initialize).toHaveBeenCalledTimes(1);
      expect(initialize.mock.calls[0]![0].nonce).toBe(csrf.googleNonce);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        fetcher.mock.calls.some(([input]) =>
          pathOf(input).endsWith('/auth/google'),
        ),
      ).toBe(false);
    },
  );
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
  it('denies Admin navigation and user API access for a Customer', async () => {
    const { fetcher, router } = mount('/admin/users', customer);
    await screen.findByRole('heading', { name: 'Access denied' });
    expect(router.state.location.pathname).toBe('/403');
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).startsWith('/api/v1/users?'),
      ),
    ).toBe(false);
  });
  it('opens Customers by default and requests each role from the server', async () => {
    const { user, fetcher } = mount('/admin/users', admin);
    await screen.findByRole('button', {
      name: `Actions for ${customer.email}`,
    });
    expect(screen.getByRole('tab', { name: 'Customers' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.queryByRole('button', { name: `Actions for ${admin.email}` }),
    ).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).includes('role=Customer'),
      ),
    ).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'Admins' }));
    await screen.findByRole('button', { name: `Actions for ${admin.email}` });
    expect(
      screen.queryByRole('button', { name: `Actions for ${customer.email}` }),
    ).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.some((call) => pathOf(call[0]).includes('role=Admin')),
    ).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'All users' }));
    await screen.findByRole('button', {
      name: `Actions for ${customer.email}`,
    });
    expect(
      screen.getByRole('button', { name: `Actions for ${admin.email}` }),
    ).toBeInTheDocument();
  });
  it('applies search and status to server queries and provides an empty-state reset', async () => {
    const { user, fetcher } = mount('/admin/users', admin);
    await screen.findByRole('button', {
      name: `Actions for ${customer.email}`,
    });
    await user.type(
      screen.getByLabelText('Search users'),
      'nobody@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('No customers found');
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).includes('search=nobody%40example.test'),
      ),
    ).toBe(true);
    await user.click(
      screen.getAllByRole('button', { name: 'Clear filters' })[0]!,
    );
    await screen.findByRole('button', {
      name: `Actions for ${customer.email}`,
    });
    await user.selectOptions(
      screen.getByLabelText('Account status'),
      'inactive',
    );
    await screen.findByText('No customers found');
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).includes('status=inactive'),
      ),
    ).toBe(true);
  });
  it('requires confirmation for roles and preserves edits on last-Admin rejection', async () => {
    const { user, fetcher } = mount('/admin/users', admin, (path, init) =>
      path.endsWith(`/${admin.id}/roles`) && init?.method === 'PUT'
        ? json({ code: 'last_active_admin' }, 409)
        : undefined,
    );
    await user.click(await screen.findByRole('tab', { name: 'Admins' }));
    await user.click(
      await screen.findByRole('button', { name: `Actions for ${admin.email}` }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Manage role' }));
    await user.selectOptions(screen.getByLabelText('Account role'), 'Customer');
    await user.click(
      screen.getByRole('button', { name: 'Review role change' }),
    );
    const confirmation = within(await screen.findByRole('alertdialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      confirmation.getByText(/You are changing your own account/),
    ).toBeInTheDocument();
    expect(
      fetcher.mock.calls.some((call) => pathOf(call[0]).endsWith('/roles')),
    ).toBe(false);
    await user.click(
      confirmation.getByRole('button', { name: 'Confirm change' }),
    );
    expect(await confirmation.findByRole('alert')).toHaveTextContent(
      'At least one active Admin must remain',
    );
    await user.click(confirmation.getByRole('button', { name: 'Cancel' }));
    await screen.findByRole('dialog');
    expect(screen.getByLabelText('Account role')).toHaveValue('Customer');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(
      payload(
        fetcher.mock.calls.find((call) =>
          pathOf(call[0]).endsWith('/roles'),
        )![1],
      ),
    ).toEqual({ roles: ['Customer'] });
  });
  it('allows cancelling a reviewed edit and requires a fresh review after changing status', async () => {
    const { user, fetcher } = mount('/admin/users', admin);
    await user.click(
      await screen.findByRole('button', {
        name: `Actions for ${customer.email}`,
      }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Edit account' }));
    await user.click(screen.getByRole('button', { name: 'Review changes' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'Account active' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(
      false,
    );
    await user.click(screen.getByRole('button', { name: 'Review changes' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
  it('cancels deactivation without sending a mutation', async () => {
    const { user, fetcher } = mount('/admin/users', admin);
    await user.click(
      await screen.findByRole('button', {
        name: `Actions for ${customer.email}`,
      }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Deactivate account' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Deactivate account' }),
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(
      fetcher.mock.calls.some((call) => call[1]?.method === 'DELETE'),
    ).toBe(false);
  });
  it('refreshes the list after confirmed deactivation', async () => {
    let inactive = false;
    const { user } = mount('/admin/users', admin, (path, init) => {
      if (path.endsWith(`/${customer.id}`) && init?.method === 'DELETE') {
        inactive = true;
        return new Response(null, { status: 204 });
      }
      if (path.startsWith('/api/v1/users?'))
        return json({
          items: [{ ...customer, isActive: !inactive }],
          totalCount: 1,
          page: 1,
          pageSize: 20,
        });
    });
    await user.click(
      await screen.findByRole('button', {
        name: `Actions for ${customer.email}`,
      }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Deactivate account' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Deactivate account' }),
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Confirm change',
      }),
    );
    await screen.findByText('Account deactivated.');
    expect(
      await screen.findByRole('cell', { name: 'Inactive' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it.each([
    { tab: 'Couriers', role: 'Courier' },
    { tab: 'Merchants', role: 'Merchant' },
    { tab: 'Dispatchers', role: 'Dispatcher' },
    { tab: 'Admins', role: 'Admin' },
  ])(
    'uses the selected $role tab when opening account creation',
    async ({ tab, role }) => {
      const { user } = mount('/admin/users', admin);
      await user.click(await screen.findByRole('tab', { name: tab }));
      await user.click(
        screen.getByRole('button', { name: `Add ${role.toLowerCase()}` }),
      );
      expect(screen.getByRole('dialog')).toHaveAccessibleName(
        `Add ${role.toLowerCase()}`,
      );
      expect(
        screen.getByText(`Create an account with the ${role} role.`),
      ).toBeInTheDocument();
    },
  );

  it('creates a Customer only after confirmation and clears password data on reopening', async () => {
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
    await user.click(
      await screen.findByRole('button', { name: 'Add customer' }),
    );
    await user.type(screen.getByLabelText('Email'), created.email);
    await user.type(screen.getByLabelText('Full name'), created.fullName);
    await user.click(screen.getByRole('button', { name: 'Generate password' }));
    const password =
      screen.getByLabelText<HTMLInputElement>('Initial password').value;
    expect(password).toHaveLength(32);
    await user.click(
      screen.getByRole('button', { name: 'Review new account' }),
    );
    expect(
      fetcher.mock.calls.some(
        (call) => call[1]?.method === 'POST' && call[0] === '/api/v1/users',
      ),
    ).toBe(false);
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Confirm change',
      }),
    );
    await screen.findByText(/Customer account created/);
    const call = fetcher.mock.calls.find(
      (call) => call[1]?.method === 'POST' && call[0] === '/api/v1/users',
    )!;
    expect(payload(call[1])).toEqual({
      email: created.email,
      fullName: created.fullName,
      isActive: true,
      password,
      role: 'Customer',
    });
    expect(
      JSON.stringify(
        queries
          .getMutationCache()
          .getAll()
          .map((value) => value.state.variables),
      ),
    ).not.toContain(password);
    await user.click(screen.getByRole('button', { name: 'Add customer' }));
    expect(screen.getByLabelText('Initial password')).toHaveValue('');
  });
  it('keeps audit records out of user management', async () => {
    const { fetcher } = mount('/admin/users', admin);
    await screen.findByRole('heading', { name: 'User management' });
    expect(screen.getByRole('link', { name: 'Audit log' })).toHaveAttribute(
      'href',
      '/admin/audit',
    );
    expect(
      fetcher.mock.calls.some((call) =>
        pathOf(call[0]).includes('/audit-logs'),
      ),
    ).toBe(false);
  });
});
