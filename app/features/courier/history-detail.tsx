import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Eye, Package, CalendarDays } from 'lucide-react';
import { Button } from '~/shared/components/ui/button';
import { Badge } from '~/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/shared/components/ui/dialog';
import { Separator } from '~/shared/components/ui/separator';
import { WorkspaceLoading } from '~/shared/components/workspace-state';
import { deliveryFailureLabel } from '~/shared/delivery-failure';
import { useCourier } from './context';
import { CourierReadFailure } from './read-failure';
import type { Summary } from './api';

const time = (value: string) =>
  new Intl.DateTimeFormat('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Colombo',
  }).format(new Date(value));
export function HistoryDetails({ delivery }: { delivery: Summary }) {
  const [open, setOpen] = useState(false);
  const { api, scope } = useCourier();
  const q = useQuery({
    queryKey: ['courier', scope, 'history-detail', delivery.id],
    queryFn: () => api.historyDetail(delivery.id),
    enabled: open,
    retry: false,
  });
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Eye aria-hidden="true" />
        View details
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delivery history details</DialogTitle>
            <DialogDescription>{delivery.trackingNumber}</DialogDescription>
          </DialogHeader>
          {q.isPending ? (
            <WorkspaceLoading label="Loading delivery history details..." />
          ) : q.isError ? (
            <CourierReadFailure
              error={q.error}
              retry={() => void q.refetch()}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge
                  variant={
                    q.data.status === 'Failed' ? 'destructive' : 'secondary'
                  }
                >
                  {q.data.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Asia/Colombo time
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm font-medium">
                <span>{q.data.pickupCity}</span>
                <ArrowRight
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{q.data.deliveryCity}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                <div>
                  <dt className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    Service date
                  </dt>
                  <dd>{q.data.serviceDate}</dd>
                </div>
                <div>
                  <dt className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="size-3.5" aria-hidden="true" />
                    Parcel
                  </dt>
                  <dd>
                    {q.data.packageDetails.size} ·{' '}
                    {q.data.packageDetails.weightKg} kg
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Assigned
                  </dt>
                  <dd>{time(q.data.assignedAt)}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-xs text-muted-foreground">
                    Picked up
                  </dt>
                  <dd>
                    {q.data.pickedUpAt
                      ? time(q.data.pickedUpAt)
                      : 'Not recorded'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="mb-1 text-xs text-muted-foreground">
                    {q.data.status === 'Failed' ? 'Failed at' : 'Delivered at'}
                  </dt>
                  <dd className="font-medium">{time(q.data.completedAt)}</dd>
                </div>
              </dl>
              {q.data.status === 'Failed' && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-destructive">
                    Failure reason
                  </p>
                  {deliveryFailureLabel(q.data.failureReason)}
                </div>
              )}
              <Separator />
              <p className="text-xs text-muted-foreground">
                {q.data.hasProof
                  ? 'Proof of delivery was recorded.'
                  : q.data.status === 'Delivered'
                    ? 'No proof record is available.'
                    : 'This delivery was not completed.'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
