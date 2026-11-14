import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { IdentityApi } from '~/features/identity/api';
import { Protected } from '~/features/identity/components';
import { IdentityProvider, IdentitySession } from '~/features/identity/session';
import { csrf, customer, json, pair } from '~/features/identity/test-fixtures';
import { AssignmentDialog } from './assignment-dialog';

const parcelId = '11111111-1111-4111-8111-111111111111';
const courierId = '22222222-2222-4222-8222-222222222222';
const oldId = '33333333-3333-4333-8333-333333333333';
const options = {
  parcelId,
  parcelVersion: 2,
  reassign: true,
  currentAssignment: { courierId: oldId, serviceDate: '2026-11-16' },
  businessToday: '2026-11-14',
  operationsTimeZone: 'Asia/Colombo',
  serviceDate: '2026-11-16',
  items: [
    { courierId, onDuty: false, activeCountForServiceDate: 0, capacity: 2 },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 20,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function mount({
  read = (_params: URLSearchParams): Response | Promise<Response> => {
    void _params;
    return json(options);
  },
  write = (_init?: RequestInit): Response | Promise<Response> => {
    void _init;
    return json({
      id: parcelId,
      trackingNumber: 'TRK-1',
      status: 'Assigned',
      version: 3,
      priceSnapshot: { total: 500, currency: 'LKR', pricingVersion: 'v1' },
      createdAt: '2026-11-14T00:00:00Z',
    });
  },
} = {}) {
  const reads = vi.fn(read),
    writes = vi.fn(write);
  const profile = { ...customer, roles: ['Dispatcher'] as ['Dispatcher'] };
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      'http://localhost',
    );
    if (url.pathname.endsWith('/auth/csrf')) return json(csrf);
    if (url.pathname.endsWith('/auth/refresh'))
      return json(pair(profile, profile.id));
    if (url.pathname.endsWith('/assignment-options'))
      return reads(url.searchParams);
    if (url.pathname.endsWith('/deliveries/assign')) return writes(init);
    return json({ code: 'not_found' }, 404);
  });
  vi.stubGlobal('fetch', fetcher);
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = new IdentitySession(new IdentityApi(fetcher), () =>
    queries.clear(),
  );
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <Protected roles={['Dispatcher', 'Admin']}>
          <AssignmentDialog
            parcelId={parcelId}
            trackingNumber="TRK-1"
            reassign
            close={() => {}}
            restoreFocus={() => {}}
          />
        </Protected>
      ),
    },
  ]);
  render(
    <StrictMode>
      <QueryClientProvider client={queries}>
        <IdentityProvider session={session}>
          <RouterProvider router={router} />
        </IdentityProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
  return { user: userEvent.setup(), reads, writes, queries };
}
it.each([
  ['2026-11-16', '2026-11-16'],
  ['2026-11-13', '2026-11-14'],
])(
  'uses the server-selected date %s → %s and requires a reason',
  async (original, selectedDate) => {
    const { user, writes, reads } = mount({
      read: () =>
        json({
          ...options,
          currentAssignment: { courierId: oldId, serviceDate: original },
          serviceDate: selectedDate,
        }),
    });
    const choose = await screen.findByRole('button', {
      name: `Select courier ${courierId}`,
    });
    expect(reads.mock.calls.at(-1)?.[0].get('reassign')).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Service date' }),
    ).toHaveTextContent(selectedDate);
    await user.click(choose);
    const confirm = screen.getByRole('button', {
      name: 'Confirm reassignment',
    });
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByRole('textbox', { name: 'Reassignment reason' }),
      '  Route unavailable  ',
    );
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await screen.findByText(/Reassignment confirmed/);
    expect(JSON.parse(writes.mock.calls[0]?.[0]?.body as string)).toMatchObject(
      {
        reassign: true,
        reason: 'Route unavailable',
        expectedVersion: 2,
        serviceDate: selectedDate,
      },
    );
  },
);
it('clears selection and confirmation at refresh start and after a newer preview arrives', async () => {
  let resolve!: (response: Response) => void;
  let refreshing = false;
  const { user, queries, writes } = mount({
    read: () =>
      refreshing
        ? new Promise<Response>((r) => {
            resolve = r;
          })
        : json(options),
  });
  await user.click(
    await screen.findByRole('button', { name: `Select courier ${courierId}` }),
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Reassignment reason' }),
    'Keep draft reason',
  );
  expect(
    screen.getByRole('button', { name: 'Confirm reassignment' }),
  ).toBeEnabled();
  refreshing = true;
  let request!: Promise<void>;
  await act(async () => {
    request = queries.invalidateQueries({
      queryKey: ['dispatch-assignment-options'],
    });
    screen.getByRole('button', { name: 'Confirm reassignment' }).click();
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Confirm reassignment' }),
    ).toBeDisabled(),
  );
  expect(screen.queryByText(/Confirm TRK-1/)).not.toBeInTheDocument();
  await act(async () => {
    resolve(json({ ...options, parcelVersion: 3 }));
    await request;
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: `Select courier ${courierId}` }),
    ).toBeEnabled(),
  );
  expect(
    screen.getByRole('button', { name: 'Confirm reassignment' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('textbox', { name: 'Reassignment reason' }),
  ).toHaveValue('Keep draft reason');
  expect(writes).not.toHaveBeenCalled();
});
it('retains reason, body and key after an uncertain request and explains cancellation', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-14T12:00:00Z'));
  const { user, writes, queries } = mount({
    write: () => {
      throw new TypeError('lost');
    },
  });
  await user.click(
    await screen.findByRole('button', { name: `Select courier ${courierId}` }),
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Reassignment reason' }),
    'Replacement needed',
  );
  await user.click(
    screen.getByRole('button', { name: 'Confirm reassignment' }),
  );
  await screen.findByText(/does not guarantee server rollback/);
  expect(
    screen.getByRole('textbox', { name: 'Reassignment reason' }),
  ).toBeDisabled();
  await act(() =>
    queries.invalidateQueries({ queryKey: ['dispatch-assignment-options'] }),
  );
  vi.setSystemTime(new Date('2026-11-14T12:00:02Z'));
  await user.click(
    await screen.findByRole('button', { name: 'Retry same assignment' }),
  );
  expect(writes).toHaveBeenCalledTimes(2);
  expect(writes.mock.calls[0]?.[0]?.body).toBe(writes.mock.calls[1]?.[0]?.body);
  expect(writes.mock.calls[0]?.[0]?.headers).toEqual(
    writes.mock.calls[1]?.[0]?.headers,
  );
});
