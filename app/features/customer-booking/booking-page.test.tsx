import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '~/providers';
import { CustomerBookingPage } from './booking-page';
import { confirmationBody } from './api';
import type { BookingEnvironment, PendingAttempt } from './contracts';
import { memoryAttemptStore } from './contracts';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const quoteId = '33333333-3333-4333-8333-333333333333';
const parcelId = '44444444-4444-4444-8444-444444444444';
const zoneId = '55555555-5555-4555-8555-555555555555';

function quote(
  total = '540.00',
  expiresAt = new Date(Date.now() + 600_000).toISOString(),
) {
  return new Response(
    `{"quoteId":"${quoteId}","total":${total},"currency":"LKR","pricingVersion":"fixture-v1","expiresAt":"${expiresAt}","fingerprint":"opaque"}`,
  );
}

function receipt(total = '540.00') {
  return new Response(
    `{"id":"${parcelId}","trackingNumber":"SERVER-RETURNED-TRACKING","status":"Created","version":1,"priceSnapshot":{"total":${total},"currency":"LKR","pricingVersion":"fixture-v1"},"createdAt":"2026-10-24T12:00:00Z"}`,
    { status: 201 },
  );
}

function problem(code: string, status: number, headers?: HeadersInit) {
  return new Response(
    JSON.stringify({
      code,
      status,
      detail: 'PRIVATE-RESPONSE-MUST-NOT-RENDER',
    }),
    { status, headers },
  );
}

function setup(
  request = vi.fn<(path: string, init: RequestInit) => Promise<Response>>(),
) {
  if (!request.getMockImplementation())
    request.mockImplementation((path) =>
      Promise.resolve(path.endsWith('quotes') ? quote() : receipt()),
    );
  const environment: BookingEnvironment = {
    session: { principalId: owner, roles: ['Customer'] },
    request,
    zones: {
      load: () =>
        Promise.resolve([{ id: zoneId, name: 'North delivery area' }]),
    },
    attempts: memoryAttemptStore(),
  };
  const view = render(
    <AppProviders>
      <CustomerBookingPage environment={environment} />
    </AppProviders>,
  );
  return { environment, request, ...view };
}

async function fillForm() {
  await waitFor(() =>
    expect(screen.getByLabelText('Pickup area')).toHaveTextContent(
      'North delivery area',
    ),
  );
  const fields = {
    'Pickup street address': 'Fictional pickup street',
    'Pickup city': 'Fictional city',
    'Pickup postal code': '00000',
    'Delivery street address': 'Fictional delivery street',
    'Delivery city': 'Fictional city',
    'Delivery postal code': '00000',
    'Recipient name': 'Fictional recipient',
    'Recipient phone number': '0000000000',
    'Weight (kg)': '2.5',
    'Pickup area': zoneId,
    'Delivery area': zoneId,
  };
  for (const [label, value] of Object.entries(fields))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function preview() {
  await fillForm();
  fireEvent.click(screen.getByRole('button', { name: 'Get delivery quote' }));
  await screen.findByLabelText('Quoted total');
}

afterEach(() => vi.restoreAllMocks());

describe('Customer booking interaction', () => {
  it('keeps the normal application closed without an injected Customer session', () => {
    render(
      <AppProviders>
        <CustomerBookingPage />
      </AppProviders>,
    );
    expect(screen.getByText('Customer sign-in required')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Get delivery quote' }),
    ).not.toBeInTheDocument();
  });

  it('rejects an injected non-Customer without making API requests', () => {
    const request =
      vi.fn<(path: string, init: RequestInit) => Promise<Response>>();
    const environment: BookingEnvironment = {
      session: { principalId: owner, roles: ['Courier'] },
      request,
      zones: { load: () => Promise.resolve([]) },
      attempts: memoryAttemptStore(),
    };
    render(
      <AppProviders>
        <CustomerBookingPage environment={environment} />
      </AppProviders>,
    );
    expect(screen.getByText('Customer sign-in required')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('validates required fields and exact weight before requesting a quote', async () => {
    const { request } = setup();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Get delivery quote' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Get delivery quote' }));
    await screen.findAllByText('This field is required.');
    expect(request).not.toHaveBeenCalled();
    await fillForm();
    fireEvent.change(screen.getByLabelText('Weight (kg)'), {
      target: { value: '30.0001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Get delivery quote' }));
    await screen.findByText(
      'Enter an exact weight greater than 0 and at most 30 kg.',
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('previews the server quote and decline never submits a parcel', async () => {
    const { request } = setup();
    await preview();
    expect(screen.getByLabelText('Quoted total')).toHaveTextContent(
      'LKR 540.00',
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('Your delivery is booked'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Decline quote' }));
    expect(screen.queryByLabelText('Quoted total')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'No delivery was booked',
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('books only on explicit confirmation and displays server-returned tracking', async () => {
    const { request, environment } = setup();
    await preview();
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm & book delivery' }),
    );
    await screen.findByText('Your delivery is booked');
    expect(screen.getByLabelText('Tracking number')).toHaveTextContent(
      'SERVER-RETURNED-TRACKING',
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]![0]).toBe('/api/v1/parcels');
    expect(environment.attempts.read(owner)).toBeNull();
  });

  it('prevents duplicate confirmation clicks synchronously', async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    const request = vi
      .fn<(path: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(quote())
      .mockReturnValueOnce(pending);
    setup(request);
    await preview();
    const confirm = screen.getByRole('button', {
      name: 'Confirm & book delivery',
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Recipient name')).toBeDisabled();
    await act(async () => {
      resolve(receipt());
      await pending;
    });
    await screen.findByText('Your delivery is booked');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('invalidates an unsubmitted quote after recipient input changes', async () => {
    setup();
    await preview();
    fireEvent.change(screen.getByLabelText('Recipient name'), {
      target: { value: 'Another recipient' },
    });
    expect(screen.queryByLabelText('Quoted total')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Confirm & book delivery' }),
    ).not.toBeInTheDocument();
  });

  it('discards a stale estimate response after details change', async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    const request = vi
      .fn<(path: string, init: RequestInit) => Promise<Response>>()
      .mockReturnValue(pending);
    setup(request);
    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Get delivery quote' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Recipient name'), {
      target: { value: 'Changed while pending' },
    });
    await act(async () => {
      resolve(quote());
      await pending;
    });
    expect(screen.queryByLabelText('Quoted total')).not.toBeInTheDocument();
  });

  it('does not submit a quote that expired before the first confirmation', async () => {
    const clock = Date.now();
    const { request } = setup();
    await preview();
    vi.spyOn(Date, 'now').mockReturnValue(clock + 700_000);
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm & book delivery' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('quote expired');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(['quote_expired', 'price_mismatch'])(
    'requires a new preview and explicit consent after %s',
    async (code) => {
      const request = vi
        .fn<(path: string, init: RequestInit) => Promise<Response>>()
        .mockResolvedValueOnce(quote())
        .mockResolvedValueOnce(problem(code, 409))
        .mockResolvedValueOnce(quote('600.00'))
        .mockResolvedValueOnce(receipt('600.00'));
      setup(request);
      await preview();
      fireEvent.click(
        screen.getByRole('button', { name: 'Confirm & book delivery' }),
      );
      await screen.findByRole('alert');
      expect(screen.getByLabelText('Recipient name')).toBeEnabled();
      expect(screen.queryByLabelText('Quoted total')).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', { name: 'Get delivery quote' }),
      );
      await screen.findByLabelText('Quoted total');
      expect(screen.getByLabelText('Quoted total')).toHaveTextContent(
        'LKR 600.00',
      );
      expect(request).toHaveBeenCalledTimes(3);
      fireEvent.click(
        screen.getByRole('button', { name: 'Confirm & book delivery' }),
      );
      await screen.findByText('Your delivery is booked');
      const first = request.mock.calls[1]![1].headers as Record<string, string>;
      const second = request.mock.calls[3]![1].headers as Record<
        string,
        string
      >;
      expect(first['Idempotency-Key']).not.toBe(second['Idempotency-Key']);
    },
  );

  it('recovers a lost response using identical body/key even after local expiry', async () => {
    const clock = Date.now();
    const request = vi
      .fn<(path: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(quote())
      .mockRejectedValueOnce(new TypeError('private-network-message'))
      .mockResolvedValueOnce(receipt());
    setup(request);
    await preview();
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm & book delivery' }),
    );
    await screen.findByRole('alert');
    vi.spyOn(Date, 'now').mockReturnValue(clock + 700_000);
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry original confirmation' }),
    );
    await screen.findByText('Your delivery is booked');
    expect(request.mock.calls[2]).toEqual(request.mock.calls[1]);
    expect(
      screen.queryByText('private-network-message'),
    ).not.toBeInTheDocument();
  });

  it.each([503, 201])(
    'retains an uncertain attempt after response status %s',
    async (status) => {
      const request = vi
        .fn<(path: string, init: RequestInit) => Promise<Response>>()
        .mockResolvedValueOnce(quote())
        .mockResolvedValueOnce(
          status === 201
            ? new Response('{"incomplete":true}', { status: 201 })
            : problem('delivery_unavailable', 503),
        );
      const { environment } = setup(request);
      await preview();
      fireEvent.click(
        screen.getByRole('button', { name: 'Confirm & book delivery' }),
      );
      await screen.findByRole('alert');
      expect(environment.attempts.read(owner)).not.toBeNull();
      expect(
        screen.getByRole('button', { name: 'Retry original confirmation' }),
      ).toBeEnabled();
      expect(
        screen.queryByText('Your delivery is booked'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('PRIVATE-RESPONSE-MUST-NOT-RENDER'),
      ).not.toBeInTheDocument();
    },
  );

  it('resumes a retained attempt without obtaining another quote', async () => {
    const pending: PendingAttempt = {
      ownerId: owner,
      quoteId,
      total: '540.00',
      key: 'retained-fixture-key',
      body: confirmationBody(quoteId, '540.00'),
    };
    const request = vi
      .fn<(path: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(receipt());
    const store = memoryAttemptStore();
    store.write(pending);
    const environment: BookingEnvironment = {
      session: { principalId: owner, roles: ['Customer'] },
      request,
      zones: { load: () => Promise.resolve([]) },
      attempts: store,
    };
    render(
      <AppProviders>
        <CustomerBookingPage environment={environment} />
      </AppProviders>,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry original confirmation' }),
    );
    await screen.findByText('Your delivery is booked');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]![0]).toBe('/api/v1/parcels');
    expect(request.mock.calls[0]![1].body).toBe(pending.body);
  });

  it('clears private state on principal change and ignores stale success', async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    const request = vi
      .fn<(path: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(quote())
      .mockReturnValueOnce(pending);
    const { environment, rerender } = setup(request);
    await preview();
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm & book delivery' }),
    );
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    rerender(
      <AppProviders>
        <CustomerBookingPage
          environment={{
            ...environment,
            session: { principalId: other, roles: ['Customer'] },
          }}
        />
      </AppProviders>,
    );
    expect(environment.attempts.read(owner)).toBeNull();
    await act(async () => {
      resolve(receipt());
      await pending;
    });
    expect(
      screen.queryByText('SERVER-RETURNED-TRACKING'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Your delivery is booked'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Recipient name')).toHaveValue('');
  });

  it('does not let key conflicts become a fresh confirmation', async () => {
    const request = vi
      .fn<(path: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(quote())
      .mockResolvedValueOnce(problem('idempotency_conflict', 409));
    const { environment } = setup(request);
    await preview();
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm & book delivery' }),
    );
    await screen.findByRole('alert');
    expect(
      screen.getByRole('button', { name: 'Retry original confirmation' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Get delivery quote' }),
    ).not.toBeInTheDocument();
    expect(environment.attempts.read(owner)).not.toBeNull();
  });

  it('honors Retry-After and then retries only the original confirmation', async () => {
    const clock = Date.now();
    const request = vi
      .fn<(path: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(quote())
      .mockResolvedValueOnce(
        problem('operation_in_progress', 409, { 'Retry-After': '1' }),
      )
      .mockResolvedValueOnce(receipt());
    setup(request);
    await preview();
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm & book delivery' }),
    );
    await screen.findByRole('alert');
    expect(
      screen.getByRole('button', { name: 'Please wait before retrying' }),
    ).toBeDisabled();
    expect(request).toHaveBeenCalledTimes(2);
    vi.spyOn(Date, 'now').mockReturnValue(clock + 5000);
    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: 'Retry original confirmation' }),
        ).toBeEnabled(),
      { timeout: 2000 },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry original confirmation' }),
    );
    await screen.findByText('Your delivery is booked');
    expect(request.mock.calls[2]).toEqual(request.mock.calls[1]);
  });
});
