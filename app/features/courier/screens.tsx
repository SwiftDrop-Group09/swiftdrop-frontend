import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react';
import {
  AssignmentCard,
  HistoryCard,
  StatusTimeline,
  DeliveryStatus,
} from './presentation';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { WorkspacePage } from '~/shared/components/workspace-page';
import { FieldSet, FieldLegend } from '~/shared/components/ui/field';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '~/features/identity/session';
import { AccessGate } from '../identity/route-access';
import { IdentityShell } from '~/features/identity/components';
import { displayMoney } from '~/shared/exact-json';
import {
  CourierApi,
  CourierError,
  active,
  nextStage,
  proofAttempt,
  reasons,
  statusAttempt,
  type Attempt,
  type Detail,
  type Summary,
} from './api';
import { CourierWorkflow } from './workflow';
import { Button } from '~/shared/components/ui/button';
import { Card } from '~/shared/components/ui/card';
import { Alert } from '~/shared/components/ui/alert';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Textarea } from '~/shared/components/ui/textarea';
import { Checkbox } from '~/shared/components/ui/checkbox';
import {
  NativeSelect,
  NativeSelectOption,
} from '~/shared/components/ui/native-select';

const Context = createContext<{
  api: CourierApi;
  workflow: CourierWorkflow;
  scope: string;
} | null>(null);
function useCourier() {
  const v = useContext(Context);
  if (!v) throw Error('Courier workspace required');
  return {
    ...v,
    state: useSyncExternalStore(
      v.workflow.subscribe,
      v.workflow.getSnapshot,
      v.workflow.getSnapshot,
    ),
  };
}
function Workspace({ api, scope }: { api: CourierApi; scope: string }) {
  const [workflow] = useState(() => new CourierWorkflow(api));
  const state = useSyncExternalStore(
    workflow.subscribe,
    workflow.getSnapshot,
    workflow.getSnapshot,
  );
  useEffect(() => workflow.connect(), [workflow]);
  useEffect(() => {
    if (!state.pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.pending]);
  return (
    <Context.Provider value={{ api, scope, workflow }}>
      <div className="w-full min-w-0 space-y-6 wrap-anywhere">
        {state.notice && <p role="status">{state.notice}</p>}
        {state.pending && <Pending />}
        {state.blocked ? (
          <Alert variant="destructive">
            Access to delivery information has ended. Return to{' '}
            <Link to="/profile">your account</Link>.
          </Alert>
        ) : (
          <Outlet />
        )}
      </div>
    </Context.Provider>
  );
}
export function CourierLayout() {
  const { user, restoring, session } = useIdentity();
  if (restoring || !user || !user.roles.includes('Courier'))
    return <AccessGate roles={['Courier']}>{null}</AccessGate>;
  const scope = `${user.id}:${[...user.roles].sort().join(',')}`;
  return (
    <IdentityShell>
      <Workspace
        key={scope}
        scope={scope}
        api={new CourierApi(session.authenticatedRequest, session.api.base)}
      />
    </IdentityShell>
  );
}
function Pending() {
  const { state, workflow } = useCourier();
  const queries = useQueryClient();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return (
    <Alert aria-label="Pending delivery request" className="space-y-3">
      <p>
        The original request is retained in this open session. Keep this page
        open until its outcome is confirmed. Other actions are paused.
      </p>
      <Button
        disabled={state.busy || now < state.retryAt}
        onClick={() => {
          void workflow.submit().then((r) => {
            if (r === 'success' || r === 'reload' || r === 'denied') {
              void queries.resetQueries({ queryKey: ['courier'] });
            }
          });
        }}
      >
        {state.busy ? 'Waiting for confirmation...' : 'Retry original request'}
      </Button>
    </Alert>
  );
}
function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  const { workflow, scope } = useCourier();
  const queries = useQueryClient();
  useEffect(() => {
    if (error instanceof CourierError && [401, 403].includes(error.status)) {
      workflow.denyRead();
      queries.removeQueries({ queryKey: ['courier', scope] });
    }
  }, [error, workflow, queries, scope]);
  return (
    <Alert variant="destructive" className="space-y-3">
      <p>
        {error instanceof CourierError
          ? error.message
          : 'Unable to load deliveries.'}
      </p>
      {!(
        error instanceof CourierError && [401, 403, 404].includes(error.status)
      ) && <Button onClick={retry}>Reload</Button>}
    </Alert>
  );
}
function Pager({
  page,
  total,
  set,
}: {
  page: number;
  total: number;
  set: (p: number) => void;
}) {
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-3">
      <Button disabled={page === 1} onClick={() => set(page - 1)}>
        Previous
      </Button>
      <span>
        Page {page} / {total} deliveries
      </span>
      <Button disabled={page * 20 >= total} onClick={() => set(page + 1)}>
        Next
      </Button>
    </nav>
  );
}
function Price({ d }: { d: Summary }) {
  return (
    <span>{displayMoney(d.priceSnapshot.total, d.priceSnapshot.currency)}</span>
  );
}
export function Manifest() {
  const { api, scope } = useCourier();
  const [date, setDate] = useState('');
  const [overdue, setOverdue] = useState(true);
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['courier', scope, 'manifest', date, overdue, page],
    queryFn: () => api.manifest(date, overdue, page),
  });
  return (
    <WorkspacePage
      title={<>Assigned deliveries</>}
      actions={
        <Button
          variant="outline"
          disabled={q.isFetching}
          onClick={() => void q.refetch()}
        >
          <RefreshCw aria-hidden="true" />
          Refresh
        </Button>
      }
      description={
        <>
          With no selected date, Delivery uses today in the operations time zone
          (Asia/Colombo).
        </>
      }
    >
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-6">
        <Label className="grid gap-2">
          Service date
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
        </Label>
        <Button
          onClick={() => {
            setDate('');
            setPage(1);
          }}
        >
          Today
        </Button>
        <Label className="flex items-center gap-2 pb-2">
          <Checkbox
            checked={overdue}
            onCheckedChange={(checked) => {
              setOverdue(checked === true);
              setPage(1);
            }}
          />{' '}
          Include overdue
        </Label>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          Service days follow Asia/Colombo time.
        </p>
      </Card>
      {q.isPending ? (
        <WorkspaceLoading label="Loading assigned deliveries…" />
      ) : q.isError ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: 'Matching assignments',
                value: q.data.totalCount,
                Icon: Package,
              },
              {
                label: 'Overdue on this page',
                value: q.data.items.filter((item) => item.isOverdue).length,
                Icon: Clock3,
              },
              {
                label: 'On the road on this page',
                value: q.data.items.filter((item) =>
                  ['InTransit', 'OutForDelivery'].includes(item.status),
                ).length,
                Icon: Truck,
              },
            ].map(({ label, value, Icon }) => (
              <Card
                key={label}
                className="flex items-center justify-between gap-4 p-4 sm:p-5"
              >
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {value}
                  </p>
                </div>
                <Icon
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Card>
            ))}
          </div>
          {!q.data.items.length && (
            <WorkspaceNotice
              title="No assigned deliveries match this day."
              description="Choose another service date or include overdue deliveries."
            />
          )}
          <ul
            data-testid="courier-parcels"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {q.data.items.map((d) => (
              <li key={d.id} className="min-w-0">
                <AssignmentCard delivery={d} />
              </li>
            ))}
          </ul>
          <Pager page={page} total={q.data.totalCount} set={setPage} />
        </>
      )}
    </WorkspacePage>
  );
}
export function History() {
  const { api, scope } = useCourier();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['courier', scope, 'history', page],
    queryFn: () => api.history(page),
  });
  return (
    <WorkspacePage
      title={<>Delivery history</>}
      actions={
        <Button
          variant="outline"
          disabled={q.isFetching}
          onClick={() => void q.refetch()}
        >
          <RefreshCw aria-hidden="true" />
          Refresh
        </Button>
      }
      description={
        <>
          Your completed and failed deliveries. Private recipient details are
          available only during an active assignment.
        </>
      }
    >
      {q.isPending ? (
        <WorkspaceLoading label="Loading history..." />
      ) : q.isError ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {!q.data.items.length && (
            <WorkspaceNotice
              title="No completed or failed deliveries yet."
              description="Your finished assignments will appear here."
            />
          )}
          <ul
            data-testid="courier-parcels"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {q.data.items.map((d) => (
              <li key={d.id} className="min-w-0">
                <HistoryCard delivery={d} />
              </li>
            ))}
          </ul>
          <Pager page={page} total={q.data.totalCount} set={setPage} />
        </>
      )}
    </WorkspacePage>
  );
}
export function ParcelDetails() {
  const { id = '' } = useParams();
  const { api, scope, state } = useCourier();
  const q = useQuery({
    queryKey: ['courier', scope, 'detail', id],
    queryFn: () => api.detail(id),
    retry: false,
  });
  if (
    state.receipt?.id === id &&
    ['Delivered', 'Failed'].includes(state.receipt.status)
  )
    return (
      <WorkspacePage
        title={<> {state.receipt.status} confirmed</>}
        description={<>{state.receipt.trackingNumber}</>}
      >
        <Link to="/courier">Back to assigned deliveries</Link>
      </WorkspacePage>
    );
  if (q.isPending) return <WorkspaceLoading label="Loading parcel..." />;
  if (q.isError)
    return <Failure error={q.error} retry={() => void q.refetch()} />;
  const d = q.data;
  return (
    <WorkspacePage
      title={<> {d.trackingNumber} </>}
      description={
        <>
          {' '}
          {d.status} / Version {d.version} / <Price d={d} />{' '}
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link to="/courier">
            <ArrowLeft aria-hidden="true" />
            Assigned deliveries
          </Link>
        </Button>
        <Button
          variant="outline"
          disabled={!!state.pending || q.isFetching}
          onClick={() => void q.refetch()}
        >
          <RefreshCw aria-hidden="true" />
          Refresh parcel
        </Button>
      </div>
      <Card className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
        <div className="space-y-2">
          <DeliveryStatus status={d.status} />
          <p className="text-sm text-muted-foreground">
            Version {d.version} | Pricing {d.priceSnapshot.pricingVersion}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Delivery fee</p>
          <p className="text-xl font-semibold">
            <Price d={d} />
          </p>
        </div>
      </Card>
      <Card className="grid gap-6 p-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Package
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
            Pickup
          </h2>
          <Address value={d.pickupAddress} />
        </div>
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <MapPin
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
            Delivery
          </h2>
          <Address value={d.deliveryAddress} />
          <p>
            {d.recipient.name}
            <br />
            {d.recipient.phoneNumber}
          </p>
        </div>
      </Card>
      <p>
        Package: {d.packageDetails.size} / {d.packageDetails.weightKg} kg
      </p>
      {d.assignment && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden="true" />
          Assignment: {d.assignment.status} / Service date{' '}
          {d.assignment.serviceDate}
        </p>
      )}
      <Actions key={`${id}:${d.version}`} d={d} />
      <StatusTimeline history={d.history} />
    </WorkspacePage>
  );
}
function Address({ value }: { value: Detail['deliveryAddress'] }) {
  return (
    <address className="text-sm not-italic leading-6 text-muted-foreground">
      {value.street}
      <br />
      {value.city} {value.postalCode}
    </address>
  );
}
export function Actions({ d }: { d: Detail }) {
  const { workflow, state } = useCourier();
  const queries = useQueryClient();
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [recipient, setRecipient] = useState('');
  const [photo, setPhoto] = useState<File>();
  const [signature, setSignature] = useState<File>();
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const submit = async (make: () => Attempt) => {
    setError('');
    try {
      const attempt = make();
      const result = await workflow.submit(attempt);
      if (['success', 'reload', 'denied'].includes(result)) {
        setPhoto(undefined);
        setSignature(undefined);
        setNotes('');
        setRecipient('');
        setRefreshing(true);
        await queries.resetQueries({ queryKey: ['courier'] });
        setRefreshing(false);
      }
    } catch (e) {
      setError(
        e instanceof CourierError ? e.message : 'Check your delivery details.',
      );
    }
  };
  if (!active(d))
    return <p>No delivery actions are available in this state.</p>;
  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-lg font-semibold">Delivery actions</h2>
      {error && <Alert variant="destructive">{error}</Alert>}
      <FieldSet
        className="space-y-4 disabled:opacity-60"
        disabled={!!state.pending || state.busy || refreshing}
      >
        <FieldLegend>Update delivery</FieldLegend>
        <Label className="grid gap-2">
          {d.status === 'OutForDelivery'
            ? 'Private failure note (optional)'
            : 'Private delivery note'}
          <Textarea
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Label>
        {nextStage[d.status] && (
          <Button
            onClick={() =>
              void submit(() => statusAttempt(d, nextStage[d.status]!, notes))
            }
          >
            Mark {nextStage[d.status]}
          </Button>
        )}
        <Label className="grid gap-2">
          Failure reason
          <NativeSelect
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <NativeSelectOption value="">Choose a reason</NativeSelectOption>
            {reasons.map((r) => (
              <NativeSelectOption key={r}>{r}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Button
          variant="destructive"
          onClick={() =>
            void submit(() =>
              statusAttempt(
                d,
                'Failed',
                notes,
                reasons.find((r) => r === reason),
              ),
            )
          }
        >
          Report failed delivery
        </Button>
        {d.status === 'OutForDelivery' && (
          <>
            <h3 className="font-semibold">Proof of delivery</h3>
            <p>
              Provide a JPEG/PNG photo or drawn signature (both accepted), up to
              5 MiB each. Delivery is confirmed after the server accepts the
              proof.
            </p>
            <Label className="grid gap-2">
              Recipient name
              <Input
                maxLength={120}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </Label>
            <Label className="grid gap-2">
              Proof photo
              <Input
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                onChange={(e) => {
                  setPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </Label>
            {photo && (
              <>
                <span>Photo selected ({Math.ceil(photo.size / 1024)} KiB)</span>
                <Button onClick={() => setPhoto(undefined)}>
                  Remove photo
                </Button>
              </>
            )}
            <Signature onChange={setSignature} />
            <Button
              className="h-auto min-h-9 w-full whitespace-normal py-2"
              onClick={() =>
                void submit(() => proofAttempt(d, recipient, photo, signature))
              }
            >
              Submit proof and complete delivery
            </Button>
          </>
        )}
      </FieldSet>
    </Card>
  );
}
function Signature({ onChange }: { onChange: (f: File | undefined) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const generation = useRef(0);
  const [notice, setNotice] = useState('');
  return (
    <div>
      <p>Optional recipient signature. Draw below, then use the signature.</p>
      <canvas
        ref={canvas}
        width={560}
        height={180}
        aria-label="Draw recipient signature"
        className="h-auto w-full max-w-140 touch-none rounded-md border border-input bg-white text-black"
        onPointerDown={(e) => {
          generation.current++;
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const r = e.currentTarget.getBoundingClientRect();
          const c = e.currentTarget.getContext('2d')!;
          c.beginPath();
          c.moveTo(
            ((e.clientX - r.left) * 560) / r.width,
            ((e.clientY - r.top) * 180) / r.height,
          );
          onChange(undefined);
          setNotice('');
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const r = e.currentTarget.getBoundingClientRect();
          const c = e.currentTarget.getContext('2d')!;
          c.lineWidth = 3;
          c.lineCap = 'round';
          c.lineTo(
            ((e.clientX - r.left) * 560) / r.width,
            ((e.clientY - r.top) * 180) / r.height,
          );
          c.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      <Button
        onClick={() => {
          if (!dirty.current) {
            setNotice('Draw a signature first.');
            return;
          }
          const current = ++generation.current;
          canvas.current?.toBlob((b) => {
            if (b && current === generation.current) {
              onChange(new File([b], 'signature.png', { type: 'image/png' }));
              setNotice('Signature selected.');
            }
          }, 'image/png');
        }}
      >
        Use signature
      </Button>
      <Button
        onClick={() => {
          canvas.current?.getContext('2d')?.clearRect(0, 0, 560, 180);
          generation.current++;
          dirty.current = false;
          onChange(undefined);
          setNotice('');
        }}
      >
        Clear signature
      </Button>
      <p role="status">{notice}</p>
    </div>
  );
}
