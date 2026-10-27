import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookingApiError, confirmationBody, CustomerBookingApi } from './api';
import type {
  BookingEnvironment,
  BookingReceipt,
  PendingAttempt,
  Quote,
  Zone,
} from './contracts';
import { memoryAttemptStore } from './contracts';
import { displayMoney } from './exact-json';
import { bookingFormSchema, emptyBookingForm, isUuid } from './validation';
import type { BookingFormValues } from './validation';

const unavailable: BookingEnvironment = {
  session: { principalId: null, roles: [] },
  request: () => Promise.reject(new BookingApiError('unauthorized', 401)),
  zones: {
    load: () => Promise.reject(new BookingApiError('zones_unavailable')),
  },
  attempts: memoryAttemptStore(),
};
const Environment = createContext<BookingEnvironment>(unavailable);

/** IAM/application composition supplies adapters; booking owns no token store. */
export function BookingEnvironmentProvider({
  value,
  children,
}: {
  value: BookingEnvironment;
  children: ReactNode;
}) {
  return <Environment.Provider value={value}>{children}</Environment.Provider>;
}

export function CustomerBookingPage({
  environment,
}: {
  environment?: BookingEnvironment;
}) {
  const supplied = useContext(Environment);
  const dependencies = environment ?? supplied;
  const principal = dependencies.session.principalId;
  const actor =
    principal &&
    isUuid(principal) &&
    dependencies.session.roles.includes('Customer')
      ? principal
      : null;
  const previous = useRef(actor);
  const queryClient = useQueryClient();
  useEffect(() => {
    const oldActor = previous.current;
    if (oldActor && oldActor !== actor) {
      dependencies.attempts.clear(oldActor);
      queryClient.removeQueries({ queryKey: ['customer-booking', oldActor] });
      const cache = queryClient.getMutationCache();
      cache
        .findAll({ mutationKey: ['customer-booking', oldActor] })
        .forEach((mutation) => cache.remove(mutation));
    }
    previous.current = actor;
  }, [actor, dependencies.attempts, queryClient]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <span className="text-xl font-black tracking-tight text-teal-800">
            SwiftDrop<span className="text-orange-500">.</span>
          </span>
          <span className="text-sm font-medium text-slate-500">
            Customer delivery
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-teal-700">
          A little less distance
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Book a delivery
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Tell us where your parcel is going. Review your quote, then confirm
          when you’re ready.
        </p>
        {!actor ? (
          <section
            className="mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-7"
            aria-labelledby="access-title"
          >
            <h2 id="access-title" className="text-lg font-semibold">
              Customer sign-in required
            </h2>
            <p className="mt-2 text-slate-600">
              {principal
                ? 'Use a Customer account to request a quote and book a delivery.'
                : 'Sign in with your Customer account to continue. Account sign-in is not available on this screen yet.'}
            </p>
          </section>
        ) : (
          <BookingFlow key={actor} actor={actor} environment={dependencies} />
        )}
      </div>
    </main>
  );
}

function errorMessage(error: BookingApiError): string {
  switch (error.code) {
    case 'quote_expired':
      return 'This quote expired. Request a new quote and review the price again.';
    case 'price_mismatch':
      return 'The accepted price could not be confirmed. Request a new quote and review it before booking.';
    case 'unauthorized':
      return 'Sign in again with the same Customer account before retrying this confirmation.';
    case 'forbidden':
      return 'A Customer account is required to book this delivery.';
    case 'unsupported_zone':
      return 'One of these delivery areas is unavailable. Check both addresses and try again.';
    case 'pricing_unavailable':
      return 'A price is not available for these details right now. Please try again later.';
    case 'operation_in_progress':
      return 'Your confirmation is still being processed. Wait a moment, then retry the same confirmation.';
    case 'idempotency_conflict':
      return 'This confirmation needs review. Keep the original attempt; do not start another booking.';
    case 'key_expired':
      return 'This confirmation is too old to replay. Check its outcome before starting another booking.';
    case 'quote_consumed':
    case 'quote_conflict':
    case 'not_found':
      return 'This quote cannot be confirmed. Check the original booking outcome before starting another attempt.';
    case 'validation':
      return 'Some details could not be accepted. Review the field messages and your original confirmation.';
    default:
      return 'We could not verify the outcome. Retry the same confirmation to safely recover your booking.';
  }
}

function BookingFlow({
  actor,
  environment,
}: {
  actor: string;
  environment: BookingEnvironment;
}) {
  const queryClient = useQueryClient();
  const api = useMemo(
    () => new CustomerBookingApi(environment.request, environment.apiBase),
    [environment.request, environment.apiBase],
  );
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: emptyBookingForm,
  });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [attempt, setAttempt] = useState<PendingAttempt | null>(() =>
    environment.attempts.read(actor),
  );
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const [error, setError] = useState<BookingApiError | null>(() =>
    environment.attempts.read(actor)
      ? new BookingApiError('network_error')
      : null,
  );
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [retryAt, setRetryAt] = useState(0);
  const attemptRef = useRef(attempt);
  const revision = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const zones = useQuery({
    queryKey: ['customer-booking', actor, 'zones'],
    queryFn: ({ signal }) => environment.zones.load(signal),
    retry: false,
  });
  const estimate = useMutation({
    mutationKey: ['customer-booking', actor, 'estimate'],
    mutationFn: (values: BookingFormValues) => api.estimate(values),
    retry: false,
  });
  const confirm = useMutation({
    mutationKey: ['customer-booking', actor, 'confirm'],
    mutationFn: (pending: PendingAttempt) => api.confirm(pending),
    retry: false,
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queryClient.removeQueries({ queryKey: ['customer-booking', actor] });
      const cache = queryClient.getMutationCache();
      cache
        .findAll({ mutationKey: ['customer-booking', actor] })
        .forEach((mutation) => cache.remove(mutation));
      // An unresolved attempt survives navigation; only a session change clears it.
    };
  }, [actor, queryClient]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function requestQuote(values: BookingFormValues) {
    if (inFlight.current || attemptRef.current) return;
    inFlight.current = true;
    const currentRevision = revision.current;
    setQuote(null);
    setError(null);
    setNotice('');
    try {
      const result = await estimate.mutateAsync(values);
      if (mounted.current && revision.current === currentRevision)
        setQuote(result);
    } catch (failure) {
      if (mounted.current && revision.current === currentRevision) {
        setError(
          failure instanceof BookingApiError
            ? failure
            : new BookingApiError('network_error'),
        );
      }
    } finally {
      inFlight.current = false;
    }
  }

  async function confirmQuote() {
    if (inFlight.current || Date.now() < retryAt) return;
    let pending = attemptRef.current;
    if (!pending) {
      if (!quote || Date.now() >= Date.parse(quote.expiresAt)) {
        setQuote(null);
        setNotice('This quote expired. Request a new quote before confirming.');
        return;
      }
      pending = Object.freeze({
        ownerId: actor,
        quoteId: quote.quoteId,
        total: quote.total,
        key: crypto.randomUUID(),
        body: confirmationBody(quote.quoteId, quote.total),
      });
      try {
        environment.attempts.write(pending);
      } catch {
        setNotice(
          'We could not safely retain this confirmation. No booking request was sent. Please try again.',
        );
        return;
      }
      attemptRef.current = pending;
      setAttempt(pending);
    }
    inFlight.current = true;
    setError(null);
    setNotice('');
    try {
      const result = await confirm.mutateAsync(pending);
      if (!mounted.current) return;
      environment.attempts.clear(actor);
      attemptRef.current = null;
      setAttempt(null);
      setQuote(null);
      setReceipt(result);
    } catch (failure) {
      if (!mounted.current) return;
      const problem =
        failure instanceof BookingApiError
          ? failure
          : new BookingApiError('network_error');
      if (
        problem.code === 'quote_expired' ||
        problem.code === 'price_mismatch'
      ) {
        environment.attempts.clear(actor);
        attemptRef.current = null;
        setAttempt(null);
        setQuote(null);
      }
      if (problem.code === 'operation_in_progress')
        setRetryAt(Date.now() + Math.max(problem.retryAfterSeconds, 1) * 1000);
      setError(problem);
    } finally {
      inFlight.current = false;
    }
  }

  const busy = estimate.isPending || confirm.isPending;
  const expired = quote ? now >= Date.parse(quote.expiresAt) : false;
  const blockedRetry =
    error &&
    [
      'idempotency_conflict',
      'key_expired',
      'quote_consumed',
      'quote_conflict',
      'not_found',
      'forbidden',
      'validation',
    ].includes(error.code);

  if (receipt)
    return (
      <section
        className="mt-9 max-w-2xl rounded-2xl border border-teal-200 bg-white p-7 sm:p-10"
        aria-labelledby="booked-title"
      >
        <span
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-2xl text-teal-800"
          aria-hidden="true"
        >
          ✓
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-teal-700">
          Confirmed
        </p>
        <h2 id="booked-title" className="mt-2 text-2xl font-bold">
          Your delivery is booked
        </h2>
        <p className="mt-3 text-slate-600">
          Keep this tracking number for your parcel.
        </p>
        <p
          className="mt-4 break-all rounded-xl bg-slate-50 p-4 font-mono text-lg font-semibold"
          aria-label="Tracking number"
        >
          {receipt.trackingNumber}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Confirmed price</dt>
            <dd className="mt-1 break-all font-semibold">
              {displayMoney(
                receipt.priceSnapshot.total,
                receipt.priceSnapshot.currency,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Parcel status</dt>
            <dd className="mt-1 font-semibold">{receipt.status}</dd>
          </div>
        </dl>
        <button
          className="mt-8 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white hover:bg-teal-900"
          onClick={() => {
            form.reset(emptyBookingForm);
            setReceipt(null);
            setNotice('');
            setError(null);
          }}
        >
          Book another delivery
        </button>
      </section>
    );

  return (
    <div className="mt-9 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <form
        onChange={() => {
          if (attemptRef.current) return;
          revision.current++;
          setQuote(null);
          setNotice('');
          setError(null);
        }}
        onSubmit={(event) => {
          void form.handleSubmit(requestQuote)(event);
        }}
        noValidate
        className="space-y-5"
      >
        <fieldset
          disabled={!!attempt}
          className="space-y-5 disabled:opacity-70"
        >
          <AddressFields
            prefix="pickup"
            title="Pickup address"
            step="01"
            register={form.register}
            errors={form.formState.errors}
            zones={zones.data ?? []}
          />
          <AddressFields
            prefix="delivery"
            title="Delivery address"
            step="02"
            register={form.register}
            errors={form.formState.errors}
            zones={zones.data ?? []}
          />
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <SectionTitle step="03" title="Recipient & parcel" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                name="recipientName"
                label="Recipient name"
                register={form.register}
                errors={form.formState.errors}
                autoComplete="name"
              />
              <Field
                name="recipientPhone"
                label="Recipient phone number"
                register={form.register}
                errors={form.formState.errors}
                type="tel"
                autoComplete="tel"
              />
              <Field
                name="weightKg"
                label="Weight (kg)"
                register={form.register}
                errors={form.formState.errors}
                inputMode="decimal"
                hint="Greater than 0, up to 30 kg"
              />
              <label className="block text-sm font-medium">
                Parcel size
                <select
                  {...form.register('size')}
                  className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3"
                >
                  <option>Small</option>
                  <option>Medium</option>
                  <option>Large</option>
                </select>
              </label>
            </div>
          </section>
        </fieldset>
        {zones.isPending && (
          <p role="status" className="text-sm text-slate-600">
            Loading delivery areas…
          </p>
        )}
        {zones.isError && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
          >
            Delivery areas are unavailable.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => {
                void zones.refetch();
              }}
            >
              Try again
            </button>
          </div>
        )}
        {!attempt && (
          <button
            type="submit"
            disabled={
              busy || zones.isPending || zones.isError || !zones.data?.length
            }
            className="w-full rounded-xl bg-teal-800 px-6 py-4 font-semibold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {estimate.isPending ? 'Getting your quote…' : 'Get delivery quote'}
          </button>
        )}
      </form>
      <aside
        className="rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-6"
        aria-labelledby="quote-title"
      >
        <h2 id="quote-title" className="text-lg font-bold">
          Your delivery quote
        </h2>
        {!quote && !attempt && (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Complete your delivery details to see the price. Requesting a quote
            does not book a parcel.
          </p>
        )}
        {quote && (
          <>
            <p
              className="mt-6 break-all text-3xl font-bold tracking-tight"
              aria-label="Quoted total"
            >
              {displayMoney(quote.total, quote.currency)}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              {expired && !attempt
                ? 'Quote expired — request a new quote.'
                : `Quote expires ${new Date(quote.expiresAt).toLocaleTimeString()}`}
            </p>
            {!attempt && (
              <>
                <p className="mt-5 text-sm leading-6 text-slate-600">
                  By confirming, you accept this quoted total for the delivery
                  details above.
                </p>
                <button
                  type="button"
                  disabled={busy || expired}
                  onClick={() => {
                    void confirmQuote();
                  }}
                  className="mt-5 w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
                >
                  Confirm & book delivery
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuote(null);
                    setNotice('Quote declined. No delivery was booked.');
                  }}
                  className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Decline quote
                </button>
              </>
            )}
          </>
        )}
        {attempt && (
          <>
            <p className="mt-5 text-sm leading-6 text-slate-600">
              {confirm.isPending
                ? 'Confirming your delivery. Please keep this screen open.'
                : 'The booking outcome is not verified yet. Your original confirmation is retained so a retry cannot create a second parcel.'}
            </p>
            <button
              type="button"
              disabled={busy || now < retryAt || !!blockedRetry}
              onClick={() => {
                void confirmQuote();
              }}
              className="mt-5 w-full rounded-xl bg-teal-800 px-4 py-3 font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
            >
              {confirm.isPending
                ? 'Confirming…'
                : now < retryAt
                  ? 'Please wait before retrying'
                  : 'Retry original confirmation'}
            </button>
          </>
        )}
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
          >
            {attempt ||
            [
              'quote_expired',
              'price_mismatch',
              'unsupported_zone',
              'pricing_unavailable',
            ].includes(error.code)
              ? errorMessage(error)
              : 'We could not get a quote. Check your details and connection, then try again.'}
            {Object.entries(error.fieldErrors).map(([field, messages]) => (
              <p key={field} className="mt-2">
                {messages.join(' ')}
              </p>
            ))}
          </div>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm leading-6 text-slate-600">
            {notice}
          </p>
        )}
        <div className="mt-7 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">
          You stay in control. A delivery is created only after you explicitly
          confirm a valid quote.
        </div>
      </aside>
    </div>
  );
}

function SectionTitle({ step, title }: { step: string; title: string }) {
  return (
    <h2 className="flex items-center gap-3 font-bold">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-xs text-teal-800">
        {step}
      </span>
      {title}
    </h2>
  );
}

function Field({
  name,
  label,
  register,
  errors,
  type = 'text',
  autoComplete,
  inputMode,
  hint,
}: {
  name: keyof BookingFormValues;
  label: string;
  register: UseFormRegister<BookingFormValues>;
  errors: FieldErrors<BookingFormValues>;
  type?: string;
  autoComplete?: string;
  inputMode?: 'decimal';
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        {...register(name)}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] || hint ? `${name}-help` : undefined}
        className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
      />
      {(errors[name] || hint) && (
        <p
          id={`${name}-help`}
          className={`mt-1.5 text-xs ${errors[name] ? 'text-red-700' : 'text-slate-500'}`}
        >
          {errors[name]?.message ?? hint}
        </p>
      )}
    </div>
  );
}

function AddressFields({
  prefix,
  title,
  step,
  register,
  errors,
  zones,
}: {
  prefix: 'pickup' | 'delivery';
  title: string;
  step: string;
  register: UseFormRegister<BookingFormValues>;
  errors: FieldErrors<BookingFormValues>;
  zones: readonly Zone[];
}) {
  const zone = `${prefix}ZoneId` as const;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <SectionTitle step={step} title={title} />
      <div className="mt-5 space-y-4">
        <Field
          name={`${prefix}Street`}
          label={`${prefix === 'pickup' ? 'Pickup' : 'Delivery'} street address`}
          register={register}
          errors={errors}
          autoComplete="street-address"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name={`${prefix}City`}
            label={`${prefix === 'pickup' ? 'Pickup' : 'Delivery'} city`}
            register={register}
            errors={errors}
            autoComplete="address-level2"
          />
          <Field
            name={`${prefix}PostalCode`}
            label={`${prefix === 'pickup' ? 'Pickup' : 'Delivery'} postal code`}
            register={register}
            errors={errors}
            autoComplete="postal-code"
          />
        </div>
        <div>
          <label htmlFor={zone} className="block text-sm font-medium">
            {prefix === 'pickup' ? 'Pickup' : 'Delivery'} area
          </label>
          <select
            id={zone}
            {...register(zone)}
            aria-invalid={!!errors[zone]}
            aria-describedby={errors[zone] ? `${zone}-help` : undefined}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
          >
            <option value="">Choose an area</option>
            {zones.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {errors[zone] && (
            <p id={`${zone}-help`} className="mt-1.5 text-xs text-red-700">
              {errors[zone].message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
