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
import { UnassignDialog } from './unassign-dialog';

const parcelId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mount({
  write = (_init?: RequestInit): Response | Promise<Response> => {
    void _init;
    return json({
      id: parcelId,
      trackingNumber: 'TRK-1',
      status: 'Created',
      version: 3,
      priceSnapshot: { total: 500, currency: 'LKR', pricingVersion: 'v1' },
      createdAt: '2026-11-14T00:00:00Z',
    });
  },
  onClose = vi.fn(),
  onRestoreFocus = vi.fn(),
} = {}) {
  const writes = vi.fn(write);
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
    if (url.pathname.endsWith('/deliveries/unassign')) return writes(init);
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
          <UnassignDialog
            parcelId={parcelId}
            trackingNumber="TRK-1"
            parcelVersion="2"
            close={onClose}
            restoreFocus={onRestoreFocus}
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
  return { writes, onClose, onRestoreFocus, queries };
}

it('renders unassign dialog with tracking number and action buttons', async () => {
  mount();
  expect(await screen.findByText('Unassign courier')).toBeInTheDocument();
  expect(screen.getByText('Parcel TRK-1')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Confirm unassign' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  expect(screen.getByLabelText(/Reason \(optional\)/i)).toBeInTheDocument();
});

it('submits unassignment without reason and shows confirmation', async () => {
  const user = userEvent.setup();
  const { writes } = mount();

  const confirmBtn = await screen.findByRole('button', {
    name: 'Confirm unassign',
  });
  await user.click(confirmBtn);

  await waitFor(() => {
    expect(writes).toHaveBeenCalledTimes(1);
  });

  const call = writes.mock.calls[0][0];
  const headers = new Headers(call?.headers);
  expect(headers.get('Idempotency-Key')).toBeTruthy();
  const body = JSON.parse(call?.body as string);
  expect(body.parcelId).toBe(parcelId);
  expect(body.expectedVersion).toBe(2);
  expect(body.reason).toBeUndefined();

  expect(
    await screen.findByText(
      /Courier unassigned successfully. The parcel has been returned to Created status./i,
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
});

it('submits unassignment with optional reason when provided', async () => {
  const user = userEvent.setup();
  const { writes } = mount();

  const reasonInput = await screen.findByLabelText(/Reason \(optional\)/i);
  await user.type(reasonInput, 'Courier vehicle breakdown');

  const confirmBtn = screen.getByRole('button', {
    name: 'Confirm unassign',
  });
  await user.click(confirmBtn);

  await waitFor(() => {
    expect(writes).toHaveBeenCalledTimes(1);
  });

  const body = JSON.parse(writes.mock.calls[0][0]?.body as string);
  expect(body.reason).toBe('Courier vehicle breakdown');

  expect(
    await screen.findByText(/Courier unassigned successfully/i),
  ).toBeInTheDocument();
});

it('displays error message when unassignment fails', async () => {
  const user = userEvent.setup();
  mount({
    write: () => json({ code: 'stale_version' }, 409),
  });

  const confirmBtn = await screen.findByRole('button', {
    name: 'Confirm unassign',
  });
  await user.click(confirmBtn);

  expect(
    await screen.findByText(
      /The parcel changed. Reload available couriers before confirming again./i,
    ),
  ).toBeInTheDocument();
});

it('invokes close callback when Cancel or Done is clicked', async () => {
  const user = userEvent.setup();
  const { onClose } = mount();

  const cancelBtn = await screen.findByRole('button', { name: 'Cancel' });
  await user.click(cancelBtn);
  expect(onClose).toHaveBeenCalledTimes(1);
});
