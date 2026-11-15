import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Package,
  RefreshCw,
  Phone,
  CheckCircle2,
} from 'lucide-react';
import { StatusTimeline, DeliveryStatus } from './presentation';
import { WorkspaceLoading } from '~/shared/components/workspace-state';
import { WorkspacePage } from '~/shared/components/workspace-page';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, Outlet, useParams, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '~/features/identity/session';
import { AccessGate } from '../identity/route-access';
import { IdentityShell } from '~/features/identity/components';
import { displayMoney } from '~/shared/exact-json';
import { CourierApi, type Detail, type Summary } from './api';
import { Pending } from './pending';
import { CourierReadFailure } from './read-failure';
import { CourierWorkflow } from './workflow';
import { Button } from '~/shared/components/ui/button';
import { Progress } from '~/shared/components/ui/progress';
import { Card } from '~/shared/components/ui/card';
import { Alert } from '~/shared/components/ui/alert';

import { CourierContext as Context, useCourier } from './context';
import { Actions } from './actions';
export { Manifest, History } from './queues';
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
function Price({ d }: { d: Summary }) {
  return (
    <span>{displayMoney(d.priceSnapshot.total, d.priceSnapshot.currency)}</span>
  );
}
export function ParcelDetails() {
  const { id = '' } = useParams();
  const location = useLocation();
  const routeState: unknown = location.state;
  const origin =
    routeState && typeof routeState === 'object' && 'returnTo' in routeState
      ? routeState.returnTo
      : null;
  const back =
    typeof origin === 'string' && /^\/courier(?:\?[^#]*)?$/.test(origin)
      ? origin
      : '/courier';
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
        <Card className="gap-4 p-4 sm:p-6">
          <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">
            {state.receipt.trackingNumber}
          </h2>
          <p className="text-sm text-muted-foreground">
            {state.receipt.status === 'Delivered'
              ? 'The recipient and proof have been recorded. Your daily work has been updated.'
              : 'The failure has been recorded and is visible to the booking customer or merchant after their status refresh.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={back}>Back to assigned deliveries</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/courier/history">View delivery history</Link>
            </Button>
          </div>
        </Card>
      </WorkspacePage>
    );
  if (q.isPending) return <WorkspaceLoading label="Loading parcel..." />;
  if (q.isError)
    return (
      <CourierReadFailure error={q.error} retry={() => void q.refetch()} />
    );
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
          <Link to={back}>
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
            Service date: {d.assignment?.serviceDate ?? 'Not scheduled'}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Delivery fee</p>
          <p className="text-xl font-semibold">
            <Price d={d} />
          </p>
        </div>
      </Card>
      <Progress
        value={
          ([
            'Assigned',
            'PickedUp',
            'InTransit',
            'OutForDelivery',
            'Delivered',
          ].indexOf(d.status) +
            1) *
          20
        }
        aria-label="Delivery stages"
      />
      <Actions key={`${id}:${d.version}`} d={d} />
      <Card className="grid gap-6 p-4 sm:grid-cols-2 sm:p-6">
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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">{d.recipient.name}</p>
            <Button asChild variant="outline" size="sm">
              <a
                href={`tel:${d.recipient.phoneNumber.replace(/[^+0-9]/g, '')}`}
              >
                <Phone aria-hidden="true" />
                {d.recipient.phoneNumber}
              </a>
            </Button>
          </div>
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
