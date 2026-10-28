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
import './styles.css';

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
      <div className="courier">
        <nav aria-label="Courier navigation">
          <Link to="/courier">Assigned deliveries</Link>
          <Link to="/courier/history">Delivery history</Link>
        </nav>
        {state.notice && <p role="status">{state.notice}</p>}
        {state.pending && <Pending />}
        {state.blocked ? (
          <p role="alert">
            Access to delivery information has ended. Return to{' '}
            <Link to="/profile">your account</Link>.
          </p>
        ) : (
          <Outlet />
        )}
      </div>
    </Context.Provider>
  );
}
export function CourierLayout() {
  const { user, restoring, session } = useIdentity();
  if (restoring)
    return (
      <IdentityShell>
        <p role="status">Restoring your session…</p>
      </IdentityShell>
    );
  if (!user)
    return (
      <IdentityShell>
        <p>Sign in with a Courier account to view deliveries.</p>
        <Link to="/login">Sign in</Link>
      </IdentityShell>
    );
  if (!user.roles.includes('Courier'))
    return (
      <IdentityShell>
        <p role="alert">A Courier account is required.</p>
      </IdentityShell>
    );
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
    <aside aria-label="Pending delivery request">
      <p>
        The original request is retained in this open session. Keep this page
        open until its outcome is confirmed. Other actions are paused.
      </p>
      <button
        disabled={state.busy || now < state.retryAt}
        onClick={() => {
          void workflow.submit().then((r) => {
            if (r === 'success' || r === 'reload' || r === 'denied') {
              void queries.resetQueries({ queryKey: ['courier'] });
            }
          });
        }}
      >
        {state.busy ? 'Waiting for confirmation…' : 'Retry original request'}
      </button>
    </aside>
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
    <div role="alert">
      <p>
        {error instanceof CourierError
          ? error.message
          : 'Unable to load deliveries.'}
      </p>
      {!(
        error instanceof CourierError && [401, 403, 404].includes(error.status)
      ) && <button onClick={retry}>Reload</button>}
    </div>
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
    <nav aria-label="Pagination">
      <button disabled={page === 1} onClick={() => set(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} · {total} deliveries
      </span>
      <button disabled={page * 20 >= total} onClick={() => set(page + 1)}>
        Next
      </button>
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
    <>
      <h1>Assigned deliveries</h1>
      <p>
        With no selected date, Delivery uses today in the operations time zone
        (Asia/Colombo).
      </p>
      <div className="filters">
        <label>
          Service date
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <button
          onClick={() => {
            setDate('');
            setPage(1);
          }}
        >
          Today
        </button>
        <label>
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => {
              setOverdue(e.target.checked);
              setPage(1);
            }}
          />{' '}
          Include overdue
        </label>
        <button onClick={() => void q.refetch()}>Refresh</button>
      </div>
      {q.isPending ? (
        <p role="status">Loading assigned deliveries…</p>
      ) : q.isError ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {!q.data.items.length && (
            <p>No assigned deliveries match this day.</p>
          )}
          <ul className="parcels">
            {q.data.items.map((d) => (
              <li key={d.id}>
                <Link to={`/courier/parcels/${d.id}`}>{d.trackingNumber}</Link>
                <strong>{d.status}</strong>
                {d.isOverdue && <span className="overdue">Overdue</span>}
                <p>
                  {d.recipient.name} · {d.deliveryAddress.city}
                </p>
                <p>Service date: {d.serviceDate}</p>
                <Price d={d} />
              </li>
            ))}
          </ul>
          <Pager page={page} total={q.data.totalCount} set={setPage} />
        </>
      )}
    </>
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
    <>
      <h1>Delivery history</h1>
      <p>
        Your completed and failed deliveries. Private recipient details are
        available only during an active assignment.
      </p>
      {q.isPending ? (
        <p role="status">Loading history…</p>
      ) : q.isError ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {!q.data.items.length && (
            <p>No completed or failed deliveries yet.</p>
          )}
          <ul className="parcels">
            {q.data.items.map((d) => (
              <li key={d.id}>
                <strong>{d.trackingNumber}</strong>
                <span>{d.status}</span>
                <Price d={d} />
                <p>Created: {new Date(d.createdAt).toLocaleString()}</p>
                <small>
                  Version {d.version} · Pricing {d.priceSnapshot.pricingVersion}
                </small>
              </li>
            ))}
          </ul>
          <Pager page={page} total={q.data.totalCount} set={setPage} />
        </>
      )}
    </>
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
      <>
        <h1>{state.receipt.status} confirmed</h1>
        <p>{state.receipt.trackingNumber}</p>
        <Link to="/courier">Back to assigned deliveries</Link>
      </>
    );
  if (q.isPending) return <p role="status">Loading parcel…</p>;
  if (q.isError)
    return <Failure error={q.error} retry={() => void q.refetch()} />;
  const d = q.data;
  return (
    <>
      <h1>{d.trackingNumber}</h1>
      <p>
        {d.status} · Version {d.version} · <Price d={d} />
      </p>
      <button disabled={!!state.pending} onClick={() => void q.refetch()}>
        Refresh parcel
      </button>
      <section className="parcel-addresses">
        <div>
          <h2>Pickup</h2>
          <Address value={d.pickupAddress} />
        </div>
        <div>
          <h2>Delivery</h2>
          <Address value={d.deliveryAddress} />
          <p>
            {d.recipient.name}
            <br />
            {d.recipient.phoneNumber}
          </p>
        </div>
      </section>
      <p>
        Package: {d.packageDetails.size} · {d.packageDetails.weightKg} kg
      </p>
      {d.assignment && (
        <p>
          Assignment: {d.assignment.status} · Service date{' '}
          {d.assignment.serviceDate}
        </p>
      )}
      <Actions key={`${id}:${d.version}`} d={d} />
      <h2>Status history</h2>
      <ol>
        {d.history.map((h, i) => (
          <li key={i}>
            {h.fromStatus ? `${h.fromStatus} → ` : ''}
            {h.toStatus} · {new Date(h.timestamp).toLocaleString()}
            {h.changeReason && <p>Reason: {h.changeReason}</p>}
            {h.deliveryNote && <p>{h.deliveryNote}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}
function Address({ value }: { value: Detail['deliveryAddress'] }) {
  return (
    <address>
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
    <section>
      <h2>Delivery actions</h2>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={!!state.pending || state.busy || refreshing}>
        <legend>Update delivery</legend>
        <label>
          {d.status === 'OutForDelivery'
            ? 'Private failure note (optional)'
            : 'Private delivery note'}
          <textarea
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {nextStage[d.status] && (
          <button
            onClick={() =>
              void submit(() => statusAttempt(d, nextStage[d.status]!, notes))
            }
          >
            Mark {nextStage[d.status]}
          </button>
        )}
        <label>
          Failure reason
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason</option>
            {reasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button
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
        </button>
        {d.status === 'OutForDelivery' && (
          <>
            <h3>Proof of delivery</h3>
            <p>
              Provide a JPEG/PNG photo or drawn signature (both accepted), up to
              5 MiB each. Delivery is confirmed after the server accepts the
              proof.
            </p>
            <label>
              Recipient name
              <input
                maxLength={120}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </label>
            <label>
              Proof photo
              <input
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                onChange={(e) => {
                  setPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {photo && (
              <>
                <span>Photo selected ({Math.ceil(photo.size / 1024)} KiB)</span>
                <button onClick={() => setPhoto(undefined)}>
                  Remove photo
                </button>
              </>
            )}
            <Signature onChange={setSignature} />
            <button
              onClick={() =>
                void submit(() => proofAttempt(d, recipient, photo, signature))
              }
            >
              Submit proof and complete delivery
            </button>
          </>
        )}
      </fieldset>
    </section>
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
        style={{
          touchAction: 'none',
          width: '100%',
          maxWidth: 560,
          border: '1px solid',
        }}
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
      <button
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
      </button>
      <button
        onClick={() => {
          canvas.current?.getContext('2d')?.clearRect(0, 0, 560, 180);
          generation.current++;
          dirty.current = false;
          onChange(undefined);
          setNotice('');
        }}
      >
        Clear signature
      </button>
      <p role="status">{notice}</p>
    </div>
  );
}
