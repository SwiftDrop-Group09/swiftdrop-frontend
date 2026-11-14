import {
  Check,
  CircleCheck,
  ClipboardCheck,
  MapPin,
  Package,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Progress } from '~/shared/components/ui/progress';
import { WorkspacePage } from '~/shared/components/workspace-page';
import { Button } from '~/shared/components/ui/button';
import { Card } from '~/shared/components/ui/card';
import { Alert } from '~/shared/components/ui/alert';
import { Badge } from '~/shared/components/ui/badge';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import {
  Field as FormField,
  FieldDescription,
  FieldError,
  FieldSet,
} from '~/shared/components/ui/field';
import {
  NativeSelect,
  NativeSelectOption,
} from '~/shared/components/ui/native-select';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
  profile,
  navigationGuard,
  viewDelivery,
}: {
  profile?: {
    fullName: string;
    phoneNumber: string | null;
    address: string | null;
  };
  navigationGuard?: (unfinished: boolean, discard: () => void) => ReactNode;
  viewDelivery?: (id: string) => void;
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
      queryClient.removeQueries({
        queryKey: ['customer-booking-draft', oldActor],
      });
      const cache = queryClient.getMutationCache();
      cache
        .findAll({ mutationKey: ['customer-booking', oldActor] })
        .forEach((mutation) => cache.remove(mutation));
    }
    previous.current = actor;
  }, [actor, dependencies.attempts, queryClient]);

  return (
    <WorkspacePage
      title={<>Book a delivery</>}
      description="Tell us where your parcel is going. Review your quote, then confirm when you are ready."
    >
      {!actor ? (
        <Card className="space-y-3 p-6" aria-labelledby="access-title">
          <h2 id="access-title" className="text-lg font-semibold">
            Customer sign-in required
          </h2>
          <p className="text-sm text-muted-foreground">
            {principal
              ? 'Use a Customer account to request a quote and book a delivery.'
              : 'Sign in with your Customer account to continue.'}
          </p>
        </Card>
      ) : (
        <BookingFlow
          key={actor}
          actor={actor}
          environment={dependencies}
          profile={profile}
          navigationGuard={navigationGuard}
          viewDelivery={viewDelivery}
        />
      )}
    </WorkspacePage>
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
  profile,
  navigationGuard,
  viewDelivery,
}: {
  actor: string;
  profile?: {
    fullName: string;
    phoneNumber: string | null;
    address: string | null;
  };
  navigationGuard?: (unfinished: boolean, discard: () => void) => ReactNode;
  viewDelivery?: (id: string) => void;
  environment: BookingEnvironment;
}) {
  const queryClient = useQueryClient();
  const api = useMemo(
    () => new CustomerBookingApi(environment.request, environment.apiBase),
    [environment.request, environment.apiBase],
  );
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues:
      queryClient.getQueryData<BookingFormValues>([
        'customer-booking-draft',
        actor,
      ]) ?? emptyBookingForm,
  });
  const [step, setStep] = useState(() =>
    environment.attempts.read(actor) ? 3 : 0,
  );
  const [unfinished, setUnfinished] = useState(
    () => !!queryClient.getQueryData(['customer-booking-draft', actor]),
  );
  const steps = ['Pickup', 'Delivery & recipient', 'Parcel', 'Review & price'];
  const stepFields: (keyof BookingFormValues)[][] = [
    ['pickupStreet', 'pickupCity', 'pickupPostalCode', 'pickupZoneId'],
    [
      'deliveryStreet',
      'deliveryCity',
      'deliveryPostalCode',
      'deliveryZoneId',
      'recipientName',
      'recipientPhone',
    ],
    ['weightKg', 'size'],
  ];
  const values = useWatch({ control: form.control });
  useEffect(() => {
    return form.subscribe({
      formState: { values: true },
      callback: ({ values: value }) => {
        const dirty =
          JSON.stringify(value) !== JSON.stringify(emptyBookingForm);
        setUnfinished(dirty);
        if (dirty)
          queryClient.setQueryData(['customer-booking-draft', actor], {
            ...value,
          });
        else
          queryClient.removeQueries({
            queryKey: ['customer-booking-draft', actor],
          });
      },
    });
  }, [actor, form, queryClient]);
  function applyProfile(kind: 'pickup' | 'recipient') {
    if (!profile || attemptRef.current) return;
    revision.current++;
    setQuote(null);
    if (kind === 'pickup')
      form.setValue('pickupStreet', profile.address ?? '', {
        shouldDirty: true,
      });
    else {
      form.setValue('recipientName', profile.fullName, { shouldDirty: true });
      form.setValue('recipientPhone', profile.phoneNumber ?? '', {
        shouldDirty: true,
      });
    }
  }
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
  const hasUnsavedWork = !receipt && (unfinished || !!attempt);
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedWork]);
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
      setUnfinished(false);
      queryClient.removeQueries({
        queryKey: ['customer-booking-draft', actor],
      });
      void queryClient.invalidateQueries({
        queryKey: ['customer-parcels', actor],
      });
      void queryClient.invalidateQueries({
        queryKey: ['customer-delivery-summary', actor],
      });
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
      <Card
        className="space-y-4 border-primary/20 p-4 sm:p-6"
        aria-labelledby="booked-title"
      >
        <Badge
          variant="outline"
          className="size-14 justify-center rounded-2xl border-primary/20 bg-primary/5 p-0 text-primary"
          aria-hidden="true"
        >
          <CircleCheck className="size-7" />
        </Badge>
        <Badge variant="secondary" className="w-fit">
          Booking confirmed
        </Badge>
        <h2 id="booked-title" className="mt-2 text-2xl font-bold">
          Your delivery is booked
        </h2>
        <p className="mt-3 text-muted-foreground">
          Your booking is confirmed. Follow your parcel with the tracking number
          below.
        </p>
        <p
          className="mt-4 break-all rounded-xl border border-primary/15 bg-primary/5 p-4 font-mono text-lg font-semibold"
          aria-label="Tracking number"
        >
          {receipt.trackingNumber}
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Confirmed price</dt>
            <dd className="mt-1 break-all font-semibold">
              {displayMoney(
                receipt.priceSnapshot.total,
                receipt.priceSnapshot.currency,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Parcel status</dt>
            <dd className="mt-1 font-semibold">{receipt.status}</dd>
          </div>
        </dl>
        {viewDelivery && (
          <Button onClick={() => viewDelivery(receipt.id)}>
            View delivery details
          </Button>
        )}
        <Button
          variant="outline"
          className="mt-3 w-full sm:w-auto"
          onClick={() => {
            form.reset(emptyBookingForm);
            setStep(0);
            setReceipt(null);
            setNotice('');
            setError(null);
          }}
        >
          Book another delivery
        </Button>
      </Card>
    );

  return (
    <div className="space-y-6">
      {navigationGuard?.(unfinished || !!attempt, () => {
        queryClient.removeQueries({
          queryKey: ['customer-booking-draft', actor],
        });
      })}
      <Card className="border-primary/20">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium">Let's get your parcel moving</p>
              <p className="text-sm text-muted-foreground">
                {
                  [
                    'Start with where we should collect your parcel.',
                    'Choose its destination and who will receive it.',
                    'A few parcel details help us calculate the right price.',
                    'Check your details, review the price, then confirm when you are ready.',
                  ][step]
                }
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              Step {step + 1} of {steps.length}
            </Badge>
          </div>
          <Progress
            value={((step + 1) / steps.length) * 100}
            aria-label="Booking progress"
            aria-valuetext={`Step ${step + 1} of ${steps.length}: ${steps[step]}`}
            className="h-1.5 bg-primary/10 [&>div]:bg-primary"
          />
          <nav aria-label="Booking steps">
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {steps.map((label, index) => (
                <li key={label}>
                  <Button
                    className={`h-full min-h-12 w-full justify-start whitespace-normal px-3 py-3 text-left ${step === index ? 'border border-primary/20 bg-primary/5 text-foreground hover:bg-primary/10' : ''}`}
                    variant={step === index ? 'secondary' : 'ghost'}
                    disabled={index > step || !!attempt || busy}
                    aria-current={step === index ? 'step' : undefined}
                    onClick={() => setStep(index)}
                  >
                    <Badge
                      variant="outline"
                      className="size-6 shrink-0 justify-center rounded-full p-0"
                    >
                      {index < step ? (
                        <>
                          <Check
                            className="size-3.5 text-primary"
                            aria-hidden="true"
                          />
                          <span className="sr-only">{index + 1}</span>
                        </>
                      ) : (
                        index + 1
                      )}
                    </Badge>
                    {label}
                  </Button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </Card>
      <div
        className={
          step === 3 || attempt
            ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]'
            : 'grid items-start gap-6'
        }
      >
        <form
          onChange={() => {
            if (attemptRef.current) return;
            revision.current++;
            setQuote(null);
            setNotice('');
            setError(null);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            if (step < 3) {
              void form
                .trigger(stepFields[step], { shouldFocus: true })
                .then((valid) => {
                  if (valid) setStep((current) => current + 1);
                });
            } else
              void form.handleSubmit(requestQuote, (errors) => {
                const first = stepFields.findIndex((fields) =>
                  fields.some((field) => errors[field]),
                );
                if (first >= 0) setStep(first);
              })(event);
          }}
          noValidate
          className="space-y-5"
        >
          <FieldSet
            disabled={!!attempt}
            className="space-y-5 disabled:opacity-70"
          >
            <div hidden={step !== 0} className="space-y-4">
              {profile?.address && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyProfile('pickup')}
                >
                  Use my profile address for pickup
                </Button>
              )}
              <AddressFields
                prefix="pickup"
                title="Pickup address"
                step="01"
                register={form.register}
                errors={form.formState.errors}
                zones={zones.data ?? []}
              />
              <p className="text-sm text-muted-foreground">
                Confirm the city, postal code and service area even when using
                your profile address.
              </p>
            </div>
            <div hidden={step !== 1} className="space-y-4">
              <AddressFields
                prefix="delivery"
                title="Delivery address"
                step="02"
                register={form.register}
                errors={form.formState.errors}
                zones={zones.data ?? []}
              />
              <Card className="space-y-4 p-4 sm:p-6">
                <SectionTitle step="02" title="Recipient" />
                {profile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => applyProfile('recipient')}
                  >
                    Use my details as recipient
                  </Button>
                )}
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <BookingInput
                    name="recipientName"
                    label="Recipient name"
                    register={form.register}
                    errors={form.formState.errors}
                    autoComplete="name"
                  />
                  <BookingInput
                    name="recipientPhone"
                    label="Recipient phone number"
                    register={form.register}
                    errors={form.formState.errors}
                    type="tel"
                    autoComplete="tel"
                  />
                </div>
              </Card>
            </div>
            <div hidden={step !== 2}>
              <Card className="space-y-4 p-4 sm:p-6">
                <SectionTitle step="03" title="Parcel" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <BookingInput
                    name="weightKg"
                    label="Weight (kg)"
                    register={form.register}
                    errors={form.formState.errors}
                    inputMode="decimal"
                    hint="Greater than 0, up to 30 kg"
                  />
                  <FormField>
                    <Label htmlFor="size">Parcel size</Label>
                    <NativeSelect id="size" {...form.register('size')}>
                      <NativeSelectOption>Small</NativeSelectOption>
                      <NativeSelectOption>Medium</NativeSelectOption>
                      <NativeSelectOption>Large</NativeSelectOption>
                    </NativeSelect>
                  </FormField>
                </div>
              </Card>
            </div>
            <div hidden={step !== 3}>
              <Card className="space-y-5 p-4 sm:p-6">
                <SectionTitle step="04" title="Review your delivery" />
                {[
                  [
                    'Pickup',
                    `${values.pickupStreet}, ${values.pickupCity} ${values.pickupPostalCode}`,
                    zones.data?.find((zone) => zone.id === values.pickupZoneId)
                      ?.name,
                    0,
                  ],
                  [
                    'Delivery & recipient',
                    `${values.deliveryStreet}, ${values.deliveryCity} ${values.deliveryPostalCode}`,
                    `${values.recipientName} · ${values.recipientPhone}`,
                    1,
                  ],
                  [
                    'Parcel',
                    `${values.size} · ${values.weightKg} kg`,
                    'Price is based on the delivery address zone.',
                    2,
                  ],
                ].map(([title, detail, extra, targetStep]) => (
                  <div
                    key={title}
                    className="flex items-start justify-between gap-3 border-b pb-4 last:border-0"
                  >
                    <div className="min-w-0 space-y-1 text-sm">
                      <h3 className="font-medium">{title}</h3>
                      <p className="break-words">{detail}</p>
                      <p className="text-muted-foreground">{extra}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${title}`}
                      disabled={!!attempt}
                      onClick={() => setStep(Number(targetStep))}
                    >
                      Edit
                    </Button>
                  </div>
                ))}
              </Card>
            </div>
          </FieldSet>
          {zones.isPending && (
            <p role="status" className="text-sm text-muted-foreground">
              Loading delivery areas…
            </p>
          )}
          {zones.isError && (
            <Alert variant="destructive">
              Delivery areas are unavailable.{' '}
              <Button
                type="button"
                className="mt-3 w-full sm:w-auto"
                onClick={() => {
                  void zones.refetch();
                }}
              >
                Try again
              </Button>
            </Alert>
          )}
          {zones.isSuccess && zones.data.length === 0 && (
            <Alert>
              No delivery areas are available yet. Please try again later.
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            {step > 0 && !attempt && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </Button>
            )}
            {step < 3 && !attempt && (
              <Button
                type="submit"
                disabled={
                  busy ||
                  zones.isPending ||
                  zones.isError ||
                  !zones.data?.length
                }
              >
                Continue
              </Button>
            )}
            {step === 3 && !attempt && (
              <Button
                type="submit"
                disabled={
                  busy ||
                  zones.isPending ||
                  zones.isError ||
                  !zones.data?.length
                }
                className="w-full sm:w-auto"
              >
                {estimate.isPending
                  ? 'Getting your quote…'
                  : 'Get delivery quote'}
              </Button>
            )}
          </div>
        </form>
        <Card
          hidden={step !== 3 && !attempt}
          className="min-w-0 space-y-4 border-primary/20 p-4 sm:p-6 xl:sticky xl:top-6"
          aria-labelledby="quote-title"
        >
          <h2
            id="quote-title"
            className="flex items-center gap-3 text-lg font-semibold"
          >
            <Badge
              variant="outline"
              className="size-9 justify-center rounded-xl border-primary/20 bg-primary/5 p-0 text-primary"
              aria-hidden="true"
            >
              <Wallet className="size-4" />
            </Badge>
            Your delivery quote
          </h2>
          {!quote && !attempt && (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Complete your delivery details to see the price. Requesting a
              quote does not book a parcel.
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
              <p className="mt-3 text-sm text-muted-foreground">
                {expired && !attempt
                  ? 'Quote expired — request a new quote.'
                  : `Quote expires ${new Date(quote.expiresAt).toLocaleTimeString()}`}
              </p>
              {!attempt && (
                <>
                  <p className="mt-5 text-sm leading-6 text-muted-foreground">
                    By confirming, you accept this quoted total for the delivery
                    details above.
                  </p>
                  <Button
                    type="button"
                    disabled={busy || expired}
                    onClick={() => {
                      void confirmQuote();
                    }}
                    className="mt-3 w-full sm:w-auto"
                  >
                    Confirm & book delivery
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setQuote(null);
                      setNotice('Quote declined. No delivery was booked.');
                    }}
                    className="mt-3 w-full sm:w-auto"
                  >
                    Decline quote
                  </Button>
                </>
              )}
            </>
          )}
          {attempt && (
            <>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                {confirm.isPending
                  ? 'Confirming your delivery. Please keep this screen open.'
                  : 'The booking outcome is not verified yet. Your original confirmation is retained so a retry cannot create a second parcel.'}
              </p>
              <Button
                type="button"
                disabled={busy || now < retryAt || !!blockedRetry}
                onClick={() => {
                  void confirmQuote();
                }}
                className="mt-3 w-full sm:w-auto"
              >
                {confirm.isPending
                  ? 'Confirming…'
                  : now < retryAt
                    ? 'Please wait before retrying'
                    : 'Retry original confirmation'}
              </Button>
            </>
          )}
          {error && (
            <Alert variant="destructive" className="mt-5">
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
            </Alert>
          )}
          {notice && (
            <p
              role="status"
              className="mt-4 text-sm leading-6 text-muted-foreground"
            >
              {notice}
            </p>
          )}
          <div className="mt-7 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
            You stay in control. A delivery is created only after you explicitly
            confirm a valid quote.
          </div>
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({ step, title }: { step: string; title: string }) {
  const Icon =
    title === 'Recipient'
      ? UserRound
      : step === '03'
        ? Package
        : step === '04'
          ? ClipboardCheck
          : MapPin;
  return (
    <h2 className="flex items-center gap-3 font-semibold">
      <Badge
        variant="outline"
        className="size-9 shrink-0 justify-center rounded-xl border-primary/15 bg-primary/5 p-0 text-primary"
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </Badge>
      {title}
    </h2>
  );
}

function BookingInput({
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
    <FormField data-invalid={!!errors[name]}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        {...register(name)}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] || hint ? `${name}-help` : undefined}
      />
      {errors[name] ? (
        <FieldError id={`${name}-help`}>{errors[name].message}</FieldError>
      ) : hint ? (
        <FieldDescription id={`${name}-help`}>{hint}</FieldDescription>
      ) : null}
    </FormField>
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
    <Card className="space-y-4 p-4 sm:p-6">
      <SectionTitle step={step} title={title} />
      <div className="mt-5 space-y-4">
        <BookingInput
          name={`${prefix}Street`}
          label={`${prefix === 'pickup' ? 'Pickup' : 'Delivery'} street address`}
          register={register}
          errors={errors}
          autoComplete="street-address"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <BookingInput
            name={`${prefix}City`}
            label={`${prefix === 'pickup' ? 'Pickup' : 'Delivery'} city`}
            register={register}
            errors={errors}
            autoComplete="address-level2"
          />
          <BookingInput
            name={`${prefix}PostalCode`}
            label={`${prefix === 'pickup' ? 'Pickup' : 'Delivery'} postal code`}
            register={register}
            errors={errors}
            autoComplete="postal-code"
          />
        </div>
        <div>
          <Label htmlFor={zone} className="block text-sm font-medium">
            {prefix === 'pickup' ? 'Pickup' : 'Delivery'} area
          </Label>
          <NativeSelect
            id={zone}
            {...register(zone)}
            aria-invalid={!!errors[zone]}
            aria-describedby={errors[zone] ? `${zone}-help` : undefined}
            className="mt-2"
          >
            <NativeSelectOption value="">Choose an area</NativeSelectOption>
            {zones.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {errors[zone] && (
            <p id={`${zone}-help`} className="mt-1.5 text-xs text-destructive">
              {errors[zone].message}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
