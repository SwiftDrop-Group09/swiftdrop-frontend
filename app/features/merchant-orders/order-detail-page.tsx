import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { IdentityShell, Protected } from '../identity/components';
import { StatusBadge } from '../customer-tracking/components';
import { WorkspacePage } from '~/shared/components/workspace-page';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { isInProgress, type OrderJob } from './contracts';
import {
  IN_PROGRESS_POLL_MS,
  PARCEL_STATUS_MAX_AGE_MINUTES,
  useMerchantOrder,
} from './hooks';
import {
  ApprovedBusinessGate,
  describeOrderError,
  formatUtc,
  ORDER_STATE_DESCRIPTIONS,
  OrderStateBadge,
  TrackingLink,
} from './order-display';

export function OrderDetailPage() {
  return (
    <Protected roles={['Merchant']}>
      <IdentityShell>
        <WorkspacePage
          title="Order details"
          description="Follow one order from receipt to parcel delivery."
          actions={
            <Button asChild variant="outline">
              <Link to="/merchant/orders">
                <ArrowLeft aria-hidden="true" />
                All orders
              </Link>
            </Button>
          }
        >
          <ApprovedBusinessGate>
            <OrderDetailContent />
          </ApprovedBusinessGate>
        </WorkspacePage>
      </IdentityShell>
    </Protected>
  );
}

function OrderDetailContent() {
  const { id = '' } = useParams();
  const order = useMerchantOrder(id, true);

  if (order.isPending) return <WorkspaceLoading label="Loading order…" />;

  if (order.isError) {
    const missing = 'status' in order.error && order.error.status === 404;
    return (
      <WorkspaceNotice
        destructive={!missing}
        title={missing ? 'Order not found' : 'Unable to load order'}
        description={order.error.message}
        retry={missing ? undefined : () => void order.refetch()}
        pending={order.isFetching}
      />
    );
  }

  const job = order.data;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <OrderSummary job={job} refreshing={order.isFetching} />
      <ParcelSummary job={job} />
      <OrderTimeline job={job} />
    </div>
  );
}

function OrderSummary({
  job,
  refreshing,
}: {
  job: OrderJob;
  refreshing: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="break-all font-mono text-base">
          {job.externalOrderId}
        </CardTitle>
        <CardDescription>{ORDER_STATE_DESCRIPTIONS[job.state]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Facts>
          <Fact label="Order state">
            <OrderStateBadge state={job.state} />
          </Fact>
          <Fact label="Submitted">{formatUtc(job.createdAt)}</Fact>
          <Fact label="Unsuccessful attempts">{job.attempts}</Fact>
          {job.state === 'Retrying' && (
            <Fact label="Next attempt">{formatUtc(job.nextRetryAt)}</Fact>
          )}
          <Fact label="SwiftDrop order ID">
            <span className="break-all font-mono text-xs">{job.id}</span>
          </Fact>
        </Facts>
        {job.errorCode && (
          <WorkspaceNotice
            destructive={job.state === 'Failed'}
            title={job.state === 'Failed' ? 'Why it failed' : 'Latest problem'}
            description={`${describeOrderError(job.errorCode)} (code: ${job.errorCode})`}
          />
        )}
        {isInProgress(job.state) && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <RefreshCw
              aria-hidden="true"
              className={refreshing ? 'size-4 animate-spin' : 'size-4'}
            />
            Checking for updates every {IN_PROGRESS_POLL_MS / 1000} seconds.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ParcelSummary({ job }: { job: OrderJob }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parcel</CardTitle>
        <CardDescription>
          {job.trackingNumber
            ? `Parcel status is refreshed periodically and may be up to ${PARCEL_STATUS_MAX_AGE_MINUTES} minutes old.`
            : 'A parcel and tracking number appear once SwiftDrop confirms the order.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {job.trackingNumber ? (
          <Facts>
            <Fact label="Tracking number">
              <TrackingLink code={job.trackingNumber} />
            </Fact>
            {job.parcelStatus && (
              <Fact label="Parcel status">
                <StatusBadge status={job.parcelStatus} />
              </Fact>
            )}
            <Fact label="Status changed">
              {formatUtc(job.lastStatusChangedAt)}
            </Fact>
            {job.terminalAt && (
              <Fact label="Finished">{formatUtc(job.terminalAt)}</Fact>
            )}
            <Fact label="Last refreshed">{formatUtc(job.lastRefreshedAt)}</Fact>
          </Facts>
        ) : (
          <p className="text-sm text-muted-foreground">
            {job.state === 'Failed'
              ? 'No parcel was created for this order.'
              : 'Not created yet.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type Step = {
  label: string;
  detail: string;
  status: 'done' | 'current' | 'failed' | 'upcoming';
};

/** Accepted → (retries) → parcel created / failed, built only from what the order record says. */
function timelineSteps(job: OrderJob): Step[] {
  const steps: Step[] = [
    { label: 'Received', detail: formatUtc(job.createdAt), status: 'done' },
  ];

  if (job.attempts > 0) {
    steps.push({
      label:
        job.attempts === 1
          ? '1 unsuccessful attempt'
          : `${job.attempts} unsuccessful attempts`,
      detail: job.errorCode
        ? describeOrderError(job.errorCode)
        : 'SwiftDrop retried automatically.',
      status: job.state === 'Retrying' ? 'current' : 'done',
    });
  }

  if (job.state === 'Created') {
    steps.push({
      label: 'Parcel created',
      detail: job.trackingNumber ?? '',
      status: 'done',
    });
  } else if (job.state === 'Failed') {
    steps.push({
      label: 'Failed',
      detail: 'No parcel was created.',
      status: 'failed',
    });
  } else {
    steps.push({
      label: 'Parcel created',
      detail:
        job.state === 'Retrying'
          ? `Next attempt ${formatUtc(job.nextRetryAt)}`
          : 'In progress',
      status: job.state === 'Accepted' ? 'current' : 'upcoming',
    });
  }

  return steps;
}

function OrderTimeline({ job }: { job: OrderJob }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <ol aria-label="Order progress" className="space-y-4">
          {timelineSteps(job).map((step) => (
            <li
              key={step.label}
              className="flex gap-3"
              aria-current={step.status === 'current' ? 'step' : undefined}
            >
              {step.status === 'failed' ? (
                <XCircle
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-destructive"
                />
              ) : step.status === 'done' ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-emerald-600"
                />
              ) : (
                <Circle
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                />
              )}
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                {step.detail && (
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
