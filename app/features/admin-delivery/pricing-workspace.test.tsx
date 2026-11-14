import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PricingPage from '~/portals/admin/pricing';
const mocks = vi.hoisted(() => ({
  request: vi.fn<typeof fetch>(),
  role: 'Admin',
}));
vi.mock('~/features/identity/session', () => ({
  useIdentity: () => ({
    restoring: false,
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: 'Administrator',
      email: 'admin@example.test',
      roles: [mocks.role],
      isActive: true,
      phoneNumber: null,
      address: null,
    },
    session: { api: { base: '/api' }, authenticatedRequest: mocks.request },
  }),
}));
const zone = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'Colombo Central',
  city: 'Colombo',
  servicePostalCodes: ['00100'],
  isActive: true,
  version: 5,
};
const tier = {
  id: '00000000-0000-4000-8000-000000000003',
  zoneId: zone.id,
  zoneName: zone.name,
  size: 'Small',
  pricingVersion: '2026-11',
  baseRate: 450,
  perKgRate: 60,
  currency: 'LKR',
  isActive: true,
  version: 7,
};
const medium = {
  ...tier,
  id: '00000000-0000-4000-8000-000000000004',
  size: 'Medium',
  baseRate: 650,
};
const overview = {
  items: [
    {
      zoneId: zone.id,
      zoneName: zone.name,
      isZoneActive: true,
      tierCount: 3,
      activeTiers: [tier, medium],
    },
  ],
  totalCount: 21,
  page: 1,
  pageSize: 20,
};
const json = (data: unknown, status = 200) => Response.json(data, { status });
function url(input: RequestInfo | URL) {
  return new URL(
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    'https://example.test',
  );
}
beforeEach(() => {
  mocks.role = 'Admin';
  mocks.request.mockReset();
  mocks.request.mockImplementation((input, init) => {
    if (init?.method === 'POST' || init?.method === 'PUT')
      return Promise.resolve(
        json({ ...tier, ...JSON.parse(init.body as string), version: 8 }),
      );
    const path = url(input).pathname;
    if (path.endsWith('/overview')) return Promise.resolve(json(overview));
    if (path.endsWith('/pricing-tiers'))
      return Promise.resolve(
        json({
          items: [
            tier,
            medium,
            {
              ...tier,
              id: '00000000-0000-4000-8000-000000000005',
              pricingVersion: '2026-10',
              isActive: false,
              version: 4,
            },
          ],
          totalCount: 3,
          page: 1,
          pageSize: 20,
        }),
      );
    return Promise.resolve(
      json({
        items: [zone],
        totalCount: 101,
        page: 1,
        pageSize: 20,
        cities: ['Colombo'],
      }),
    );
  });
});
function mount(path = '/admin/pricing') {
  const user = userEvent.setup();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <PricingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return user;
}
const writes = () =>
  mocks.request.mock.calls.filter(
    ([, init]) => init?.method === 'POST' || init?.method === 'PUT',
  );
async function expand(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText(zone.name);
  await user.click(
    screen.getByRole('button', {
      name: `Show pricing versions for ${zone.name}`,
    }),
  );
  await screen.findByRole('region', {
    name: `Pricing versions for ${zone.name}`,
  });
}
describe('Pricing workspace', () => {
  it('shows one zone row with size columns, and loads version actions only on expansion', async () => {
    const user = mount();
    await screen.findByText(zone.name);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.queryByRole('link', { name: 'Pricing Configuration' }),
    ).not.toBeInTheDocument();
    const row = screen.getByText(zone.name).closest('tr')!;
    expect(within(row).getByText('450.00')).toBeInTheDocument();
    expect(within(row).getByText('650.00')).toBeInTheDocument();
    expect(within(row).getByText('No active tier')).toBeInTheDocument();
    expect(
      mocks.request.mock.calls.some(([input]) =>
        url(input).pathname.endsWith('/pricing-tiers'),
      ),
    ).toBe(false);
    await expand(user);
    expect(
      screen.getByRole('button', {
        name: `Deactivate ${zone.name} Small 2026-11`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `Activate ${zone.name} Small 2026-10`,
      }),
    ).toBeInTheDocument();
  });
  it('keeps zone filtering global and resets group pagination when cleared', async () => {
    const user = mount(`/admin/pricing?zoneId=${zone.id}`);
    await screen.findByText('21 matching delivery zones', { exact: false });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.some(
          ([input]) =>
            url(input).pathname.endsWith('/overview') &&
            url(input).searchParams.get('page') === '2' &&
            url(input).searchParams.get('zoneId') === zone.id,
        ),
      ).toBe(true),
    );
    await user.click(screen.getByRole('button', { name: 'Clear zone filter' }));
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.some(
          ([input]) =>
            url(input).pathname.endsWith('/overview') &&
            url(input).searchParams.get('page') === '1' &&
            !url(input).searchParams.has('zoneId'),
        ),
      ).toBe(true),
    );
  });
  it('searches and pages zone choices without submitting a pricing draft', async () => {
    const user = mount();
    await screen.findByText(zone.name);
    await user.click(screen.getByRole('button', { name: 'Add pricing tier' }));
    await user.click(
      screen.getByRole('button', { name: 'Delivery zone for pricing tier' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Next zones' }));
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.some(
          ([input]) =>
            url(input).pathname.endsWith('/zones') &&
            url(input).searchParams.get('page') === '2',
        ),
      ).toBe(true),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Search delivery zones' }),
      '00100',
    );
    await user.click(
      screen.getByRole('button', { name: 'Search delivery zones' }),
    );
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.some(
          ([input]) =>
            url(input).searchParams.get('search') === '00100' &&
            url(input).searchParams.get('page') === '1',
        ),
      ).toBe(true),
    );
    expect(writes()).toHaveLength(0);
    expect(
      screen.queryByText('Pricing version identifier is required.'),
    ).not.toBeInTheDocument();
  });
  it('previews entered rates and confirms active creation before any write', async () => {
    const user = mount(`/admin/pricing?zoneId=${zone.id}`);
    await screen.findByRole('button', { name: 'Clear zone filter' });
    await user.click(screen.getByRole('button', { name: 'Add pricing tier' }));
    await user.type(screen.getByLabelText('Pricing version'), '2026-12');
    await user.type(screen.getByLabelText('Base rate', { exact: true }), '450');
    await user.type(screen.getByLabelText('Additional rate per kg'), '60');
    expect(
      screen.getByRole('status', { name: 'Rate preview total' }),
    ).toHaveTextContent('LKR 540.00');
    await user.clear(screen.getByLabelText('Weight (kg)'));
    await user.type(screen.getByLabelText('Weight (kg)'), '0.5');
    expect(
      screen.getByRole('status', { name: 'Rate preview total' }),
    ).toHaveTextContent('LKR 450.00');
    await user.click(screen.getByRole('button', { name: 'Create tier' }));
    expect(
      await screen.findByText('Confirm active pricing'),
    ).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
    await user.click(
      screen.getByRole('button', { name: 'Confirm and create' }),
    );
    await screen.findByText('Pricing tier 2026-12 created successfully.');
    expect(JSON.parse(writes()[0]![1]!.body as string)).toEqual({
      zoneId: zone.id,
      size: 'Small',
      pricingVersion: '2026-12',
      baseRate: 450,
      perKgRate: 60,
      currency: 'LKR',
      isActive: true,
    });
  });
  it('retains a new-version draft on duplicate rejection and protects dirty dismissal', async () => {
    const original = mocks.request.getMockImplementation()!;
    mocks.request.mockImplementation((input, init) =>
      init?.method === 'POST'
        ? Promise.resolve(
            json(
              {
                code: 'conflict',
                errors: { pricingVersion: ['This version already exists.'] },
              },
              409,
            ),
          )
        : original(input, init),
    );
    const user = mount();
    await expand(user);
    await user.click(
      screen.getByRole('button', {
        name: `Create new version for ${zone.name} Small 2026-11`,
      }),
    );
    expect(screen.getByLabelText('Base rate', { exact: true })).toHaveValue(
      '450.00',
    );
    expect(screen.getByLabelText('Pricing version')).toHaveValue('');
    await user.type(screen.getByLabelText('Pricing version'), '2026-11');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    await user.click(
      screen.getByRole('checkbox', { name: /Activate for new quotes/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Create tier' }));
    expect(
      await screen.findByText('This version already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Pricing version')).toHaveValue('2026-11');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(writes()).toHaveLength(1);
    expect(writes()[0]![1]?.method).toBe('POST');
  });
  it('blocks incomplete or over-precision rates instead of treating empty input as zero', async () => {
    const user = mount(`/admin/pricing?zoneId=${zone.id}`);
    await screen.findByRole('button', { name: 'Clear zone filter' });
    await user.click(screen.getByRole('button', { name: 'Add pricing tier' }));
    await user.type(screen.getByLabelText('Pricing version'), '2026-12');
    await user.type(screen.getByLabelText('Additional rate per kg'), '1.234');
    await user.click(screen.getByRole('button', { name: 'Create tier' }));
    expect(
      screen.getAllByText(
        'Enter a non-negative amount with up to two decimal places.',
      ),
    ).toHaveLength(2);
    expect(writes()).toHaveLength(0);
  });
  it('confirms availability with the persisted version and never auto-replays a conflict', async () => {
    const original = mocks.request.getMockImplementation()!;
    mocks.request.mockImplementation((input, init) =>
      init?.method === 'PUT'
        ? Promise.resolve(json({ code: 'conflict' }, 409))
        : original(input, init),
    );
    const user = mount();
    await expand(user);
    const action = screen.getByRole('button', {
      name: `Deactivate ${zone.name} Small 2026-11`,
    });
    await user.click(action);
    expect(writes()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(writes()).toHaveLength(0);
    await user.click(action);
    await user.click(screen.getByRole('button', { name: 'Deactivate tier' }));
    expect(
      await screen.findByText('Availability was not changed'),
    ).toBeInTheDocument();
    expect(JSON.parse(writes()[0]![1]!.body as string)).toEqual({
      isActive: false,
      expectedVersion: 7,
    });
    await user.click(screen.getByRole('button', { name: 'Close and refresh' }));
    expect(writes()).toHaveLength(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
  it.each(['Customer', 'Courier', 'Merchant', 'Dispatcher'])(
    'blocks %s before any private pricing query mounts',
    (role) => {
      mocks.role = role;
      mount();
      expect(mocks.request).not.toHaveBeenCalled();
    },
  );
});
