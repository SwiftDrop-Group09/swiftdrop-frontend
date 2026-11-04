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
});
afterEach(cleanup);
function mount(path = '/courier') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
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
  mocks.request.mockImplementation(() =>
    Promise.resolve(response(page([privateRaw()]))),
  );
  mount();
  expect(screen.getByText('Loading assigned deliveries…')).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'SD-TEST' })).toHaveAttribute(
    'href',
    `/courier/parcels/${id}`,
  );
  fireEvent.click(screen.getByLabelText('Include overdue'));
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
  mocks.request
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockImplementation(() => Promise.resolve(response(page([]))));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'connection was interrupted',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(
    await screen.findByText('No assigned deliveries match this day.'),
  ).toBeInTheDocument();
});
it('renders private details and real history, submits required note, and advances available actions', async () => {
  let advanced = false;
  mocks.request.mockImplementation((_path: string, init?: RequestInit) => {
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
  fireEvent.click(screen.getByRole('button', { name: 'Mark PickedUp' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(
    mocks.request.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    ),
  ).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Private delivery note'), {
    target: { value: 'Collected at pickup' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Mark PickedUp' }));
  expect(
    await screen.findByRole('button', { name: 'Mark InTransit' }),
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
  mocks.request.mockImplementation((_path: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      stale = true;
      return Promise.resolve(response({ code: 'stale_version' }, 409));
    }
    return Promise.resolve(
      response(privateRaw(stale ? 'InTransit' : 'Assigned', stale ? 4 : 2)),
    );
  });
  mount(`/courier/parcels/${id}`);
  await screen.findByRole('button', { name: 'Mark PickedUp' });
  fireEvent.change(screen.getByLabelText('Private delivery note'), {
    target: { value: 'Collected' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Mark PickedUp' }));
  expect(
    await screen.findByRole('button', { name: 'Mark OutForDelivery' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('choose a new action');
  expect(
    mocks.request.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    ),
  ).toHaveLength(1);
  expect(screen.getByLabelText('Private delivery note')).toHaveValue('');
});
it('failure cannot submit without reason and retains selected reason', async () => {
  mocks.request.mockImplementation((_path: string, init?: RequestInit) =>
    Promise.resolve(
      response(init?.method === 'PUT' ? raw('Failed', 3) : privateRaw()),
    ),
  );
  mount(`/courier/parcels/${id}`);
  await screen.findByRole('button', { name: 'Report failed delivery' });
  fireEvent.click(
    screen.getByRole('button', { name: 'Report failed delivery' }),
  );
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Failure reason'), {
    target: { value: 'Damaged' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Report failed delivery' }),
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
  mocks.request.mockImplementation((_path: string, init?: RequestInit) =>
    Promise.resolve(
      response(
        init?.method === 'POST'
          ? raw('Delivered', 6)
          : privateRaw('OutForDelivery', 5),
      ),
    ),
  );
  mount(`/courier/parcels/${id}`);
  await screen.findByRole('button', {
    name: 'Submit proof and complete delivery',
  });
  expect(
    screen.queryByRole('button', { name: 'Mark Delivered' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Submit proof and complete delivery' }),
  );
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Recipient name'), {
    target: { value: 'Recipient' },
  });
  fireEvent.change(screen.getByLabelText('Proof photo'), {
    target: { files: [new File(['PNG'], 'p.png', { type: 'image/png' })] },
  });
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
it('denies wrong-role accounts without calling Delivery', () => {
  mocks.identity.user.roles = ['Customer'];
  mount();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Courier account is required',
  );
  expect(mocks.request).not.toHaveBeenCalled();
});
it('session/role changes remove private details and pending form inputs', async () => {
  mocks.request.mockImplementation(() =>
    Promise.resolve(response(privateRaw())),
  );
  const view = mount(`/courier/parcels/${id}`);
  await screen.findByRole('button', { name: 'Mark PickedUp' });
  fireEvent.change(screen.getByLabelText('Private delivery note'), {
    target: { value: 'Private draft' },
  });
  mocks.identity.user = { id: 'other-account', roles: ['Customer'] };
  view.rerenderIdentity();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Courier account is required',
  );
  expect(
    screen.queryByLabelText('Private delivery note'),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Test Recipient')).not.toBeInTheDocument();
});
