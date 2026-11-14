import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { IdentityApi } from '~/features/identity/api';
import { IdentityProvider, IdentitySession } from '~/features/identity/session';
import { admin, csrf, json, pair } from '~/features/identity/test-fixtures';
import ZonesPage from './zones-page';
import PricingPage from './pricing-page';

const matchMedia = window.matchMedia.bind(window);
beforeEach(() => vi.stubGlobal('matchMedia', matchMedia));
afterEach(() => vi.unstubAllGlobals());

describe('Admin workspace read failures', () => {
  it.each([
    {
      path: '/admin/zones',
      resource: 'zones',
      Page: ZonesPage,
      title: 'Unable to load delivery zones',
      empty: 'No delivery zones configured yet.',
    },
    {
      path: '/admin/pricing',
      resource: 'pricing-tiers/overview',
      Page: PricingPage,
      title: 'Unable to load pricing tiers',
      empty: 'No delivery zones match the selected criteria.',
    },
  ])(
    'keeps the $resource shell and retries failed reads without fabricating rows',
    async ({ path, resource, Page, title, empty }) => {
      let attempts = 0;
      const fetcher = vi.fn<typeof fetch>((input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.endsWith('/auth/csrf')) return Promise.resolve(json(csrf));
        if (url.endsWith('/auth/refresh'))
          return Promise.resolve(json(pair(admin)));
        if (url.includes(`/v1/${resource}?`)) {
          attempts++;
          return Promise.resolve(
            attempts === 1
              ? json({ code: 'delivery_unavailable' }, 503)
              : json({ items: [], totalCount: 0, page: 1, pageSize: 20 }),
          );
        }
        if (url.includes('/zones/summary'))
          return Promise.resolve(json({ zones: [] }));
        if (url.includes('/v1/zones?'))
          return Promise.resolve(
            json({ items: [], totalCount: 0, page: 1, pageSize: 100 }),
          );
        return Promise.resolve(json({ code: 'not_found' }, 404));
      });
      vi.stubGlobal('fetch', fetcher);
      const queries = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const session = new IdentitySession(new IdentityApi(fetcher), () =>
        queries.clear(),
      );
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queries}>
          <IdentityProvider session={session}>
            <MemoryRouter initialEntries={[path]}>
              <Page />
            </MemoryRouter>
          </IdentityProvider>
        </QueryClientProvider>,
      );
      const failure = await screen.findByText(title);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(
        screen.getByRole('navigation', { name: 'breadcrumb' }),
      ).toBeInTheDocument();
      expect(screen.queryByText(empty)).not.toBeInTheDocument();
      const alert = failure.closest('[role="alert"]')!;
      await user.click(
        within(alert as HTMLElement).getByRole('button', { name: 'Try again' }),
      );
      expect(await screen.findByText(empty)).toBeInTheDocument();
      expect(attempts).toBe(2);
      expect(session.getSnapshot().user?.id).toBe(admin.id);
    },
  );
});
