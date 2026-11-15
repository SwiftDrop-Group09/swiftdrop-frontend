import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourierLayout, History, Manifest, ParcelDetails } from './screens';
import { id, page, privateRaw, raw, response } from './test-fixtures';
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  identity: {
    user: { id: 'courier-test', roles: ['Courier'] },
    restoring: false,
  },
}));
vi.mock('~/features/identity/session', () => ({
  useIdentity: () => ({
    ...mocks.identity,
    session: { authenticatedRequest: mocks.request, api: { base: '/api' } },
  }),
}));
beforeEach(() => {
  mocks.identity.user = { id: 'courier-test', roles: ['Courier'] };
  mocks.identity.restoring = false;
  mocks.request.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:private-proof');
  URL.revokeObjectURL = vi.fn();
});
const counts = {
  assigned: 24,
  pickedUp: 3,
  inTransit: 5,
  outForDelivery: 8,
  delivered: 10,
  failed: 2,
  active: 40,
  completed: 12,
  total: 52,
};
function requestImplementation(
  read: (path: string, init?: RequestInit) => Promise<Response>,
) {
  mocks.request.mockImplementation((path: string, init?: RequestInit) =>
    path.includes('/summary')
      ? Promise.resolve(
          response({
            serviceDate: '2026-10-28',
            timeZone: 'Asia/Colombo',
            day: counts,
            queues: counts,
            overdueCount: 6,
          }),
        )
      : read(path, init),
  );
}
afterEach(cleanup);
function mount(path = '/courier') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/403" element={<h1>Access denied</h1>} />
          <Route path="/courier" element={<CourierLayout />}>
            <Route index element={<Manifest />} />
            <Route path="history" element={<History />} />
            <Route path="parcels/:id" element={<ParcelDetails />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const rendered = render(<StrictMode>{tree()}</StrictMode>);
  return {
    ...rendered,
    client,
    rerenderIdentity: () =>
      rendered.rerender(<StrictMode>{tree()}</StrictMode>),
  };
}
it('renders manifest with day/overdue filters and only assigned links', async () => {
  requestImplementation(() => Promise.resolve(response(page([privateRaw()]))));
  mount();
  expect(
    screen.getByText('Loading assigned deliveries...'),
  ).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'SD-TEST' })).toHaveAttribute(
    'href',
    `/courier/parcels/${id}`,
  );
  fireEvent.click(screen.getByRole('button', { name: /Include overdue/ }));
  await waitFor(() =>
    expect(mocks.request.mock.calls.at(-1)?.[0]).toContain(
      'includeOverdue=false',
    ),
  );
  expect(
    await screen.findByRole('link', { name: 'SD-TEST' }),
  ).toBeInTheDocument();
});
it('renders empty and network recovery states', async () => {
  let offline = true;
  requestImplementation(() => {
    if (offline) {
      offline = false;
      return Promise.reject(new TypeError('offline'));
    }
    return Promise.resolve(response(page([])));
  });
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'connection was interrupted',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(
    await screen.findByText('No deliveries match these filters.'),
  ).toBeInTheDocument();
});
it('renders private details and real history, submits an optional note, and advances available actions', async () => {
  let advanced = false;
  requestImplementation((_path: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      advanced = true;
      return Promise.resolve(response(raw('PickedUp', 3)));
    }
    return Promise.resolve(
      response(
        privateRaw(advanced ? 'PickedUp' : 'Assigned', advanced ? 3 : 2),
      ),
    );
  });
  mount(`/courier/parcels/${id}`);
  expect(
    await screen.findByRole('heading', { name: 'SD-TEST' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Pickup street', { exact: false }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Assigned by dispatcher', { exact: false }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mark Picked Up' }));
  expect(
    screen.getByRole('button', { name: 'Confirm Picked Up' }),
  ).toBeEnabled();
  expect(
    mocks.request.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    ),
  ).toHaveLength(0);
  fireEvent.change(screen.getByLabelText(/Private delivery note/), {
    target: { value: 'Collected at pickup' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Picked Up' }));
  expect(
    await screen.findByRole('button', { name: 'Mark In Transit' }),
  ).toBeInTheDocument();
  const write = mocks.request.mock.calls.find(
    (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
  )!;
  expect(JSON.parse((write[1] as RequestInit).body as string)).toMatchObject({
    expectedVersion: 2,
    status: 'PickedUp',
    notes: 'Collected at pickup',
  });
});
it('stale action reloads changed parcel and requires a new action', async () => {
  let stale = false;
  requestImplementation((_path: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      stale = true;
      return Promise.resolve(response({ code: 'stale_version' }, 409));
    }
    return Promise.resolve(
      response(privateRaw(stale ? 'InTransit' : 'Assigned', stale ? 4 : 2)),
    );
  });
  mount(`/courier/parcels/${id}`);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Mark Picked Up' }),
  );
  fireEvent.change(screen.getByLabelText(/Private delivery note/), {
    target: { value: 'Collected' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Picked Up' }));
  expect(
    await screen.findByRole('button', { name: 'Mark Out For Delivery' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('choose a new action');
  expect(
    mocks.request.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    ),
  ).toHaveLength(1);
  expect(
    screen.queryByLabelText(/Private delivery note/),
  ).not.toBeInTheDocument();
});
it('confirms the next stage with no optional message', async () => {
  let advanced = false;
  requestImplementation((_path, init) => {
    if (init?.method === 'PUT') {
      advanced = true;
      return Promise.resolve(response(raw('PickedUp', 3)));
    }
    return Promise.resolve(
      response(
        privateRaw(advanced ? 'PickedUp' : 'Assigned', advanced ? 3 : 2),
      ),
    );
  });
  mount(`/courier/parcels/${id}`);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Mark Picked Up' }),
  );
  expect(
    screen.getByLabelText(/Private delivery note \(optional\)/),
  ).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Picked Up' }));
  await screen.findByRole('button', { name: 'Mark In Transit' });
  const write = mocks.request.mock.calls.find(
    ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
  );
  expect(JSON.parse((write![1] as RequestInit).body as string)).toMatchObject({
    notes: null,
  });
});
it('loads a compact terminal history dialog only when requested', async () => {
  requestImplementation((path) =>
    Promise.resolve(
      response(
        path.includes(`/history/${id}`)
          ? {
              ...raw('Failed', 3),
              pickupCity: 'Jaffna',
              deliveryCity: 'Anuradhapura',
              packageDetails: { size: 'Small', weightKg: 2.5 },
              serviceDate: '2026-10-28',
              assignedAt: '2026-10-28T08:00:00Z',
              pickedUpAt: null,
              completedAt: '2026-10-28T12:00:00Z',
              failureReason: 'Damaged',
              hasProof: false,
            }
          : page([raw('Failed', 3)]),
      ),
    ),
  );
  mount('/courier/history');
  const open = await screen.findByRole('button', { name: 'View details' });
  expect(
    mocks.request.mock.calls.some(([path]) =>
      String(path).includes(`/history/${id}`),
    ),
  ).toBe(false);
  fireEvent.click(open);
  await screen.findByRole('dialog', { name: 'Delivery history details' });
  await screen.findByText('Anuradhapura');
  expect(screen.getByText('Jaffna')).toBeInTheDocument();
  expect(screen.getByText('Parcel damaged')).toBeInTheDocument();
  expect(screen.queryByText('Test Recipient')).not.toBeInTheDocument();
});
it('keeps the full overdue count prominent even when excluded from a searched queue', async () => {
  requestImplementation(() => Promise.resolve(response(page([]))));
  mount('/courier?includeOverdue=false&search=unmatched');
  const toggle = await screen.findByRole('button', {
    name: /Include overdue 6/,
  });
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await screen.findByText('6 overdue deliveries')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View overdue work' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /Include overdue 6/ }),
    ).toHaveAttribute('aria-pressed', 'true'),
  );
  expect(screen.getByRole('searchbox')).toHaveValue('');
});
it('failure cannot submit without reason and retains selected reason', async () => {
  requestImplementation((_path: string, init?: RequestInit) =>
    Promise.resolve(
      response(init?.method === 'PUT' ? raw('Failed', 3) : privateRaw()),
    ),
  );
  mount(`/courier/parcels/${id}`);
  await screen.findByRole('button', { name: 'Report failed delivery' });
  fireEvent.click(
    screen.getByRole('button', { name: 'Report failed delivery' }),
  );
  expect(
    screen.getByRole('button', { name: 'Confirm failed delivery' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('combobox', { name: 'Failure reason' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Damaged' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm failed delivery' }),
  );
  expect(
    await screen.findByRole('heading', { name: 'Failed confirmed' }),
  ).toBeInTheDocument();
  const write = mocks.request.mock.calls.find(
    (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
  )!;
  expect((write[1] as RequestInit).body).toContain('"failureReason":"Damaged"');
});
it('proof validates required fields, submits private multipart and confirms from server', async () => {
  requestImplementation((_path: string, init?: RequestInit) =>
    Promise.resolve(
      response(
        init?.method === 'POST'
          ? raw('Delivered', 6)
          : privateRaw('OutForDelivery', 5),
      ),
    ),
  );
  mount(`/courier/parcels/${id}`);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Complete delivery' }),
  );
  expect(
    screen.queryByRole('button', { name: 'Mark Delivered' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Continue/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Recipient name'), {
    target: { value: 'Recipient' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  fireEvent.change(screen.getByLabelText(/Proof photo/), {
    target: { files: [new File(['PNG'], 'p.png', { type: 'image/png' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  expect(screen.getByAltText('Delivery photo preview')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit proof and complete delivery' }),
  );
  expect(
    await screen.findByRole('heading', { name: 'Delivered confirmed' }),
  ).toBeInTheDocument();
});
it('history renders only terminal summaries without private detail links', async () => {
  mocks.request.mockResolvedValue(response(page([raw('Failed', 3)])));
  mount('/courier/history');
  expect(await screen.findByText('SD-TEST')).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'SD-TEST' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Test Recipient')).not.toBeInTheDocument();
});
it('denies wrong-role accounts without calling Delivery', async () => {
  mocks.identity.user.roles = ['Customer'];
  mount();
  await screen.findByRole('heading', { name: 'Access denied' });
  expect(mocks.request).not.toHaveBeenCalled();
});
it('uses server stage counts beyond the current page and restores the originating queue', async () => {
  requestImplementation((path) =>
    Promise.resolve(
      response(
        path.includes('/assignments')
          ? { ...page([privateRaw('InTransit', 4)]), totalCount: 41, page: 2 }
          : privateRaw('InTransit', 4),
      ),
    ),
  );
  mount('/courier?date=2026-10-28&status=InTransit&search=SD&page=2');
  const tab = await screen.findByRole('tab', { name: 'In Transit 5' });
  expect(tab).toHaveAttribute('aria-selected', 'true');
  expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Open delivery' }));
  await screen.findByRole('heading', { name: 'SD-TEST' });
  fireEvent.click(
    screen.getAllByRole('link', { name: 'Assigned deliveries' }).at(-1)!,
  );
  expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
  expect(screen.getByRole('searchbox')).toHaveValue('SD');
  expect(screen.getByLabelText('Service date')).toHaveValue('2026-10-28');
  expect(
    mocks.request.mock.calls.some(
      ([path]) =>
        String(path).includes('status=InTransit') &&
        String(path).includes('page=2'),
    ),
  ).toBe(true);
});
it('keeps an uncertain stage dialog open and retries the exact original request', async () => {
  let writes = 0;
  requestImplementation((_path, init) => {
    if (init?.method === 'PUT')
      return ++writes === 1
        ? Promise.reject(new TypeError('offline'))
        : Promise.resolve(response(raw('PickedUp', 3)));
    return Promise.resolve(
      response(
        privateRaw(writes > 1 ? 'PickedUp' : 'Assigned', writes > 1 ? 3 : 2),
      ),
    );
  });
  mount(`/courier/parcels/${id}`);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Mark Picked Up' }),
  );
  fireEvent.change(screen.getByLabelText(/Private delivery note/), {
    target: { value: 'Parcel collected' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Picked Up' }));
  const retry = await screen.findByRole('button', {
    name: 'Retry original request',
  });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await waitFor(() => expect(retry).toBeEnabled(), { timeout: 2500 });
  fireEvent.click(retry);
  await screen.findByRole('button', { name: 'Mark In Transit' });
  const attempts = mocks.request.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
  );
  expect(attempts).toHaveLength(2);
  expect(attempts[0]?.[1]).toMatchObject({
    body: (attempts[1]?.[1] as RequestInit).body,
    headers: (attempts[1]?.[1] as RequestInit).headers,
  });
});
it('session/role changes remove private details and pending form inputs', async () => {
  requestImplementation(() => Promise.resolve(response(privateRaw())));
  const view = mount(`/courier/parcels/${id}`);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Mark Picked Up' }),
  );
  fireEvent.change(screen.getByLabelText(/Private delivery note/), {
    target: { value: 'Private draft' },
  });
  mocks.identity.user = { id: 'other-account', roles: ['Customer'] };
  view.rerenderIdentity();
  await screen.findByRole('heading', { name: 'Access denied' });
  expect(
    screen.queryByLabelText('Private delivery note'),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Test Recipient')).not.toBeInTheDocument();
});
