import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ZonesPage from '~/portals/admin/zones';
import PricingPage from '~/portals/admin/pricing';
import { parsePostalCodes } from './zone-editor';
const mocks = vi.hoisted(() => ({ request: vi.fn<typeof fetch>() }));
vi.mock('~/features/identity/session', () => ({
  useIdentity: () => ({
    restoring: false,
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      fullName: 'Administrator',
      email: 'admin@example.test',
      roles: ['Admin'],
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
  servicePostalCodes: ['00100', '00200', '00300', '00400'],
  isActive: true,
  version: 7,
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
  mocks.request.mockReset();
  mocks.request.mockImplementation((input, init) => {
    const path = url(input).pathname;
    if (init?.method === 'POST' || init?.method === 'PUT')
      return Promise.resolve(
        json({ ...zone, ...JSON.parse(init.body as string), version: 8 }),
      );
    if (path.endsWith('/zones/summary'))
      return Promise.resolve(
        json({
          zones: [
            {
              zoneId: zone.id,
              name: zone.name,
              total: 4,
              statusCounts: { Created: 1, Assigned: 3 },
            },
          ],
        }),
      );
    if (path.endsWith('/pricing-tiers'))
      return Promise.resolve(
        json({ items: [], totalCount: 0, page: 1, pageSize: 20 }),
      );
    return Promise.resolve(
      json({
        items: [zone],
        totalCount: 41,
        page: 1,
        pageSize: 20,
        cities: ['Colombo', 'Galle'],
      }),
    );
  });
});
function mount(pricing = false) {
  const user = userEvent.setup();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[
          pricing ? `/admin/pricing?zoneId=${zone.id}` : '/admin/zones',
        ]}
      >
        {pricing ? <PricingPage /> : <ZonesPage />}
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return user;
}
const writes = () =>
  mocks.request.mock.calls.filter(
    ([, init]) => init?.method === 'POST' || init?.method === 'PUT',
  );
describe('Coverage configuration workspace', () => {
  it('caps badges, expands coverage and loads scoped pricing on demand', async () => {
    const user = mount();
    await screen.findByText(zone.name);
    expect(screen.queryByText('00400')).not.toBeInTheDocument();
    expect(
      mocks.request.mock.calls.some(([input]) =>
        url(input).pathname.endsWith('/pricing-tiers'),
      ),
    ).toBe(false);
    await user.click(
      screen.getByRole('button', {
        name: `Show all postal codes for ${zone.name}`,
      }),
    );
    expect(await screen.findByText('00400')).toBeInTheDocument();
    expect(await screen.findByText('4', { exact: true })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Manage zone pricing' }),
    ).toHaveAttribute('href', `/admin/pricing?zoneId=${zone.id}`);
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.some(
          ([input]) => url(input).searchParams.get('zoneId') === zone.id,
        ),
      ).toBe(true),
    );
  });
  it('sends search and city/status rules to the server and clears all criteria', async () => {
    const user = mount();
    await screen.findByText(zone.name);
    await user.type(
      screen.getByRole('textbox', { name: 'Search zones' }),
      '80000',
    );
    await user.click(screen.getByRole('button', { name: 'Search zones' }));
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.some(
          ([input]) => url(input).searchParams.get('search') === '80000',
        ),
      ).toBe(true),
    );
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.selectOptions(screen.getByLabelText('Key'), 'city');
    await user.selectOptions(screen.getByLabelText('Value'), 'Galle');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.some(
          ([input]) => url(input).searchParams.get('city') === 'Galle',
        ),
      ).toBe(true),
    );
    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    await user.selectOptions(screen.getByLabelText('Key'), 'status');
    await user.selectOptions(screen.getByLabelText('Comparison'), 'isNot');
    await user.selectOptions(screen.getByLabelText('Value'), 'active');
    await user.click(screen.getByRole('button', { name: 'Add filter' }));
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.some(
          ([input]) => url(input).searchParams.get('status') === 'inactive',
        ),
      ).toBe(true),
    );
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Search zones' })).toHaveValue(
        '',
      ),
    );
    const last = url(mocks.request.mock.calls.at(-1)![0]);
    expect(last.searchParams.has('search')).toBe(false);
    expect(last.searchParams.has('city')).toBe(false);
    expect(last.searchParams.has('status')).toBe(false);
  });
  it('pastes deduplicated codes without losing zeros and creates a zone', async () => {
    const user = mount();
    await screen.findByText(zone.name);
    await user.click(screen.getByRole('button', { name: 'Add zone' }));
    await user.type(screen.getByLabelText('Zone name'), 'Galle South');
    await user.type(screen.getByLabelText('City / region'), 'Galle');
    await user.click(screen.getByRole('textbox', { name: 'Add postal codes' }));
    await user.paste('08000,08000 08100\n08200');
    expect(
      screen.getByRole('button', { name: 'Remove postal code 08000' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create zone' }));
    await screen.findByText('Delivery zone created successfully.');
    expect(JSON.parse(writes()[0]![1]!.body as string)).toEqual({
      name: 'Galle South',
      city: 'Galle',
      servicePostalCodes: ['08000', '08100', '08200'],
      isActive: true,
    });
  });
  it('retains a dirty draft on close and confirms availability before sending its saved version', async () => {
    const user = mount();
    await screen.findByText(zone.name);
    await user.click(screen.getByRole('button', { name: `Edit ${zone.name}` }));
    await user.type(screen.getByLabelText('Zone name'), ' Updated');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Zone name')).toHaveValue(
      zone.name + ' Updated',
    );
    await user.click(screen.getByRole('checkbox', { name: /Active zone/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Confirm availability change')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Confirm and save' }));
    await screen.findByText('Delivery zone updated successfully.');
    expect(JSON.parse(writes()[0]![1]!.body as string)).toMatchObject({
      isActive: false,
      expectedVersion: 7,
    });
  });
  it('keeps conflicting edits in the sheet and displays field-level overlap errors', async () => {
    const original = mocks.request.getMockImplementation()!;
    mocks.request.mockImplementation((input, init) =>
      init?.method === 'PUT'
        ? Promise.resolve(
            json(
              {
                code: 'overlapping_postal_codes',
                errors: {
                  servicePostalCodes: ['00100 belongs to another active zone.'],
                },
              },
              409,
            ),
          )
        : original(input, init),
    );
    const user = mount();
    await screen.findByText(zone.name);
    await user.click(screen.getByRole('button', { name: `Edit ${zone.name}` }));
    await user.type(screen.getByLabelText('Zone name'), ' Updated');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('00100 belongs to another active zone.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Zone name')).toHaveValue(
      zone.name + ' Updated',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('opens associated pricing with the zone query parameter applied', async () => {
    mount(true);
    await waitFor(() =>
      expect(
        mocks.request.mock.calls.some(
          ([input]) =>
            url(input).pathname.endsWith('/pricing-tiers') &&
            url(input).searchParams.get('zoneId') === zone.id,
        ),
      ).toBe(true),
    );
  });
  it('validates code entries before changing the current list', () => {
    expect(parsePostalCodes('00100,00100\n00200')).toEqual(['00100', '00200']);
    expect(parsePostalCodes('ab-1 AB-1', ['00100'])).toEqual(['00100', 'ab-1']);
    expect(() => parsePostalCodes('invalid@code', ['00100'])).toThrow();
  });
});
