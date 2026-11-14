import { AdminWorkspace } from '~/features/identity/admin-workspace';
import { useIdentity } from '~/features/identity/session';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Filter,
  Search,
  ShieldBan,
  Store,
} from 'lucide-react';
import type {
  BusinessResponse,
  BusinessStatus,
  SetMerchantStatusInput,
} from './contracts';
import { MerchantError, useMerchantApi } from './api';
import { IdentityShell, Protected } from '../identity/components';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Badge } from '~/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/shared/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';

function AdminStatusBadge({ status }: { status: BusinessStatus }) {
  switch (status) {
    case 'Approved':
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
          Approved
        </Badge>
      );
    case 'Pending':
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-300">
          Pending
        </Badge>
      );
    case 'Rejected':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'Suspended':
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-300">
          Suspended
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function AdminMerchantsPage() {
  const { user, restoring } = useIdentity();
  const api = useMerchantApi();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [modalState, setModalState] = useState<{
    business: BusinessResponse;
    targetStatus: 'Approved' | 'Rejected' | 'Suspended';
  } | null>(null);

  const [reasonInput, setReasonInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: merchants = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<BusinessResponse[]>({
    queryKey: ['admin-merchants', user?.id],
    enabled: !restoring && !!user?.roles.includes('Admin'),
    queryFn: () => api.listMerchants(),
  });

  const mutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: SetMerchantStatusInput;
    }) => {
      return api.setMerchantStatus(id, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-merchants'] });
      setModalState(null);
      setReasonInput('');
      setActionError(null);
    },
    onError: (err) => {
      if (err instanceof MerchantError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to update status.');
      }
    },
  });

  const handleQuickApprove = (business: BusinessResponse) => {
    setActionError(null);
    mutation.mutate({
      id: business.id,
      input: { status: 'Approved' },
    });
  };

  const handleModalSubmit = () => {
    if (!modalState) return;
    if (
      (modalState.targetStatus === 'Rejected' ||
        modalState.targetStatus === 'Suspended') &&
      !reasonInput.trim()
    ) {
      setActionError('Please provide a reason.');
      return;
    }

    mutation.mutate({
      id: modalState.business.id,
      input: {
        status: modalState.targetStatus,
        reason: reasonInput.trim() || null,
      },
    });
  };

  const filteredMerchants = merchants.filter((m) => {
    if (filterStatus !== 'ALL' && m.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.businessName.toLowerCase().includes(q) ||
        m.contactEmail.toLowerCase().includes(q) ||
        m.pickupAddress.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = merchants.filter((m) => m.status === 'Pending').length;
  const approvedCount = merchants.filter((m) => m.status === 'Approved').length;
  const suspendedCount = merchants.filter(
    (m) => m.status === 'Suspended' || m.status === 'Rejected',
  ).length;

  return (
    <Protected admin={true}>
      <IdentityShell>
        <AdminWorkspace
          title="Merchant Approvals"
          description="Review applicant merchants, grant shipping approvals, and manage status transitions."
        >
          {/* Metric Cards */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 lg:gap-4">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs">
                  Total Registered
                </CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {merchants.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border bg-muted/30">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs text-amber-800 font-medium">
                    Pending Review
                  </CardDescription>
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-amber-900">
                  {pendingCount}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border bg-muted/30">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs text-emerald-800 font-medium">
                    Approved Active
                  </CardDescription>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-emerald-900">
                  {approvedCount}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border bg-muted/30">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs text-rose-800 font-medium">
                    Suspended / Rejected
                  </CardDescription>
                  <ShieldBan className="h-4 w-4 text-rose-600" />
                </div>
                <CardTitle className="text-2xl font-bold text-rose-900">
                  {suspendedCount}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Action & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by business name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Status:</span>
              {(
                ['ALL', 'Pending', 'Approved', 'Rejected', 'Suspended'] as const
              ).map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setFilterStatus(status)}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          {actionError && (
            <Alert variant="destructive">
              <AlertTitle>Action Error</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          {/* Merchants Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6">
                  <WorkspaceLoading label="Loading merchants…" />
                </div>
              ) : error ? (
                <div className="p-6">
                  <WorkspaceNotice
                    title="Failed to load merchants"
                    description="Merchant records could not be loaded. Check your connection and try again."
                    destructive
                    pending={isFetching}
                    retry={() => {
                      void refetch();
                    }}
                  />
                </div>
              ) : filteredMerchants.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  <Store className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">
                    No merchants found matching the selected filter.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Contact Info</TableHead>
                      <TableHead>Pickup Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMerchants.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium text-foreground">
                          {b.businessName}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <div>{b.contactEmail}</div>
                            <div className="text-muted-foreground">
                              {b.contactPhone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-xs max-w-xs truncate"
                          title={b.pickupAddress}
                        >
                          {b.pickupAddress}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <AdminStatusBadge status={b.status} />
                            {b.rejectionReason && (
                              <p
                                className="text-xs text-destructive italic max-w-xs truncate"
                                title={b.rejectionReason}
                              >
                                Reason: {b.rejectionReason}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(b.registeredAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {b.status === 'Pending' && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleQuickApprove(b)}
                                  disabled={mutation.isPending}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setReasonInput('');
                                    setActionError(null);
                                    setModalState({
                                      business: b,
                                      targetStatus: 'Rejected',
                                    });
                                  }}
                                  disabled={mutation.isPending}
                                >
                                  Reject
                                </Button>
                              </>
                            )}

                            {b.status === 'Approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                                onClick={() => {
                                  setReasonInput('');
                                  setActionError(null);
                                  setModalState({
                                    business: b,
                                    targetStatus: 'Suspended',
                                  });
                                }}
                                disabled={mutation.isPending}
                              >
                                Suspend
                              </Button>
                            )}

                            {b.status === 'Suspended' && (
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleQuickApprove(b)}
                                disabled={mutation.isPending}
                              >
                                Re-approve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ── Action Reason Modal (Reject / Suspend) ───────────────────────── */}
          <Dialog
            open={!!modalState}
            onOpenChange={(open) => {
              if (!open) setModalState(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {modalState?.targetStatus === 'Rejected'
                    ? 'Reject Merchant Application'
                    : 'Suspend Merchant Account'}
                </DialogTitle>
                <DialogDescription>
                  Provide a mandatory explanation for{' '}
                  {modalState?.business.businessName}. This reason will be
                  visible to the merchant.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Label htmlFor="statusReason">
                  {modalState?.targetStatus === 'Rejected'
                    ? 'Rejection Reason'
                    : 'Suspension Reason'}
                </Label>
                <Input
                  id="statusReason"
                  placeholder="e.g. Missing required proof of business documents."
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  maxLength={500}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalState(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleModalSubmit}
                  disabled={mutation.isPending || !reasonInput.trim()}
                >
                  {mutation.isPending
                    ? 'Updating…'
                    : modalState?.targetStatus === 'Rejected'
                      ? 'Confirm Rejection'
                      : 'Confirm Suspension'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </AdminWorkspace>
      </IdentityShell>
    </Protected>
  );
}
