import { WorkspacePage } from '~/shared/components/workspace-page';
import { useIdentity } from '~/features/identity/session';
import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  KeyRound,
  Plus,
  ShieldAlert,
  Store,
  Webhook,
} from 'lucide-react';
import { apiKeyScopes, registerMerchantSchema } from './contracts';
import type {
  ApiKeyResponse,
  ApiKeyScope,
  BusinessResponse,
  BusinessStatus,
  OneTimeApiKeyResponse,
  RegisterMerchantInput,
} from './contracts';
import { MerchantError, useMerchantApi } from './api';
import { IdentityShell, Protected } from '../identity/components';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Checkbox } from '~/shared/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Badge } from '~/shared/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';
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

function StatusBadge({ status }: { status: BusinessStatus }) {
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
          Pending Review
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

// ── Onboarding Registration Form ─────────────────────────────────────────────

function RegisterMerchantCard({
  onRegistered,
}: {
  onRegistered: (business: BusinessResponse) => void;
}) {
  const api = useMerchantApi();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterMerchantInput>({
    resolver: zodResolver(registerMerchantSchema),
    defaultValues: {
      businessName: '',
      contactEmail: '',
      contactPhone: '',
      pickupAddress: '',
    },
  });

  const onSubmit = async (data: RegisterMerchantInput) => {
    setFormError(null);
    try {
      const created = await api.registerMerchant(data);
      onRegistered(created);
    } catch (err) {
      if (err instanceof MerchantError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to register merchant. Please try again.');
      }
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <CardTitle role="heading" aria-level={2}>
            Merchant Registration
          </CardTitle>
        </div>
        <CardDescription>
          Register your business on SwiftDrop to automate shipping and manage
          deliveries.
        </CardDescription>
      </CardHeader>

      <form
        onSubmit={(e) => {
          void handleSubmit(onSubmit)(e);
        }}
      >
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {formError && (
            <Alert variant="destructive">
              <AlertTitle>Registration Error</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label htmlFor="businessName">Business Name</Label>
            <Input
              id="businessName"
              placeholder="e.g. Acme Lanka Logistics"
              {...register('businessName')}
              aria-invalid={!!errors.businessName}
            />
            {errors.businessName && (
              <p className="text-xs text-destructive" role="alert">
                {errors.businessName.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="contactEmail">Business Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="e.g. logistics@acme.lk"
              {...register('contactEmail')}
              aria-invalid={!!errors.contactEmail}
            />
            {errors.contactEmail && (
              <p className="text-xs text-destructive" role="alert">
                {errors.contactEmail.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="contactPhone">Contact Phone Number</Label>
            <Input
              id="contactPhone"
              placeholder="e.g. +94 77 123 4567"
              {...register('contactPhone')}
              aria-invalid={!!errors.contactPhone}
            />
            {errors.contactPhone && (
              <p className="text-xs text-destructive" role="alert">
                {errors.contactPhone.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="pickupAddress">Default Pickup Address</Label>
            <Input
              id="pickupAddress"
              placeholder="e.g. 100 Galle Road, Colombo 03"
              {...register('pickupAddress')}
              aria-invalid={!!errors.pickupAddress}
            />
            {errors.pickupAddress && (
              <p className="text-xs text-destructive" role="alert">
                {errors.pickupAddress.message}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting Application…' : 'Submit Application'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// ── API Key Management Section ───────────────────────────────────────────────

function ApiKeyManager({ businessId }: { businessId: string }) {
  const api = useMerchantApi();
  const queryClient = useQueryClient();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>([
    'orders:write',
    'orders:read',
  ]);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdKeyData, setCreatedKeyData] =
    useState<OneTimeApiKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['merchant-keys', businessId],
    queryFn: () => api.listApiKeys(),
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScopes.length === 0) {
      setScopeError('Select at least one scope for the API key.');
      return;
    }

    setIsCreating(true);
    setActionError(null);
    try {
      const result = await api.createApiKey({ scopes: selectedScopes });
      setCreatedKeyData(result);
      setCreateDialogOpen(false);
      setSelectedScopes(['orders:write', 'orders:read']);
      void queryClient.invalidateQueries({
        queryKey: ['merchant-keys', businessId],
      });
    } catch (err) {
      if (err instanceof MerchantError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to create API key.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeKeyId) return;
    setActionError(null);
    try {
      await api.revokeApiKey(revokeKeyId);
      setRevokeKeyId(null);
      void queryClient.invalidateQueries({
        queryKey: ['merchant-keys', businessId],
      });
    } catch (err) {
      if (err instanceof MerchantError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to revoke API key.');
      }
    }
  };

  const copyKeyToClipboard = async () => {
    if (!createdKeyData?.apiKey) return;
    try {
      await navigator.clipboard.writeText(createdKeyData.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write errors
    }
  };

  return (
    <Card className="mt-6 ">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">API Keys</CardTitle>
          </div>
          <CardDescription>
            Authenticate shipping requests and webhook management via the
            SwiftDrop REST API.
          </CardDescription>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Generate Key
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {actionError && (
          <Alert variant="destructive">
            <AlertTitle>Action Failed</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">
            Loading API keys…
          </p>
        ) : keys.length === 0 ? (
          <Card className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No API keys generated yet. Click "Generate Key" to create your
              first integration key.
            </p>
          </Card>
        ) : (
          <Card className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key: ApiKeyResponse) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {key.keyPrefix}…
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Revoked</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {key.isActive ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setRevokeKeyId(key.id)}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Revoked{' '}
                          {key.revokedAt
                            ? new Date(key.revokedAt).toLocaleDateString()
                            : ''}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </CardContent>

      {/* ── Generate Key Dialog ────────────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription>
              Select the permissions (scopes) granted to this API key.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              void handleCreateSubmit(e);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Granted Scopes</Label>
              <div className="space-y-2">
                {apiKeyScopes.map((scope) => (
                  <div key={scope} className="flex items-center gap-2">
                    <Checkbox
                      id={`scope-${scope}`}
                      value={scope}
                      checked={selectedScopes.includes(scope)}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          setSelectedScopes((prev) => [...prev, scope]);
                          setScopeError(null);
                        } else {
                          const next = selectedScopes.filter(
                            (s) => s !== scope,
                          );
                          setSelectedScopes(next);
                          if (next.length === 0) {
                            setScopeError(
                              'Select at least one scope for the API key.',
                            );
                          }
                        }
                      }}
                    />
                    <Label
                      htmlFor={`scope-${scope}`}
                      className="font-mono text-xs cursor-pointer"
                    >
                      {scope}
                    </Label>
                  </div>
                ))}
              </div>
              {scopeError && (
                <p className="text-xs text-destructive" role="alert">
                  {scopeError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating…' : 'Create Key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── One-Time Key Reveal Modal ──────────────────────────────────────── */}
      <Dialog
        open={!!createdKeyData}
        onOpenChange={(open) => {
          if (!open) setCreatedKeyData(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
              <DialogTitle>Save Your API Key</DialogTitle>
            </div>
            <DialogDescription>
              Copy this API key now. For security purposes, this secret key will
              never be displayed again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={createdKeyData?.apiKey ?? ''}
                className="font-mono text-xs select-all bg-muted"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  void copyKeyToClipboard();
                }}
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {copied && (
              <p className="text-xs text-emerald-600 font-medium">
                Copied to clipboard!
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setCreatedKeyData(null)}
              className="w-full"
            >
              I have stored this key securely
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke Confirmation Dialog ─────────────────────────────────────── */}
      <Dialog
        open={!!revokeKeyId}
        onOpenChange={(open) => {
          if (!open) setRevokeKeyId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this API key? Any applications or
              integrations using this key will immediately lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevokeKeyId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleRevokeConfirm();
              }}
            >
              Revoke Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Main Merchant Portal Component ──────────────────────────────────────────

export function MerchantPortalPage() {
  const { user, restoring } = useIdentity();
  const api = useMerchantApi();
  const queryClient = useQueryClient();

  const {
    data: business,
    isLoading,
    error,
  } = useQuery<BusinessResponse | null>({
    queryKey: ['my-merchant-business', user?.id],
    enabled: !restoring && !!user,
    queryFn: () => api.getMyMerchant(),
  });

  return (
    <Protected>
      <IdentityShell>
        <WorkspacePage
          title={<>Merchant Portal</>}
          description="Manage your business registration, approvals, and API keys."
          actions={
            <>
              {' '}
              <div className="flex items-center gap-3">
                {business?.status === 'Approved' && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to="/merchant/webhooks"
                      className="flex items-center gap-2"
                    >
                      <Webhook className="w-4 h-4 text-emerald-600" />
                      Webhooks
                    </Link>
                  </Button>
                )}
                {business && <StatusBadge status={business.status} />}
              </div>{' '}
            </>
          }
        >
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading merchant profile…
            </p>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error instanceof Error
                  ? error.message
                  : 'Failed to load merchant profile.'}
              </AlertDescription>
            </Alert>
          ) : !business ? (
            <RegisterMerchantCard
              onRegistered={(newBiz) => {
                queryClient.setQueryData(
                  ['my-merchant-business', user?.id],
                  newBiz,
                );
              }}
            />
          ) : (
            <div className="space-y-6">
              {business.status === 'Pending' && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                  <AlertTitle className="font-semibold">
                    Application Pending Approval
                  </AlertTitle>
                  <AlertDescription>
                    Your business application has been submitted and is
                    currently under review by our administrative team. Once
                    approved, you will be able to generate API keys and begin
                    integrating with SwiftDrop.
                  </AlertDescription>
                </Alert>
              )}

              {business.status === 'Rejected' && (
                <Alert variant="destructive">
                  <AlertTitle className="font-semibold">
                    Application Rejected
                  </AlertTitle>
                  <AlertDescription>
                    {business.rejectionReason
                      ? `Reason: ${business.rejectionReason}`
                      : 'Your application was rejected by the administration. Please contact support for assistance.'}
                  </AlertDescription>
                </Alert>
              )}

              {business.status === 'Suspended' && (
                <Alert variant="destructive">
                  <AlertTitle className="font-semibold">
                    Account Suspended
                  </AlertTitle>
                  <AlertDescription>
                    {business.rejectionReason
                      ? `Reason: ${business.rejectionReason}`
                      : 'Your merchant account has been temporarily suspended. Please contact support.'}
                  </AlertDescription>
                </Alert>
              )}

              {business.status === 'Approved' && (
                <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-border bg-muted text-foreground rounded-lg">
                  <div>
                    <h3 className="font-semibold text-base">
                      Account Approved & Active
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Your business is fully approved. You can generate API keys
                      below or configure delivery status webhooks.
                    </p>
                  </div>
                  <Button asChild className="shrink-0">
                    <Link
                      to="/merchant/webhooks"
                      className="flex items-center gap-2"
                    >
                      <Webhook className="w-4 h-4" />
                      Configure Webhooks
                    </Link>
                  </Button>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Business Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">
                      Business Name
                    </span>
                    <span className="font-medium text-foreground">
                      {business.businessName}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">
                      Contact Email
                    </span>
                    <span className="font-medium text-foreground">
                      {business.contactEmail}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">
                      Contact Phone
                    </span>
                    <span className="font-medium text-foreground">
                      {business.contactPhone}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">
                      Registered Date
                    </span>
                    <span className="font-medium text-foreground">
                      {new Date(business.registeredAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground block text-xs">
                      Default Pickup Address
                    </span>
                    <span className="font-medium text-foreground">
                      {business.pickupAddress}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {business.status === 'Approved' ? (
                <ApiKeyManager businessId={business.id} />
              ) : (
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base text-muted-foreground">
                      API Key Management
                    </CardTitle>
                    <CardDescription>
                      API key generation is disabled while your business status
                      is{' '}
                      <span className="font-semibold">{business.status}</span>.
                      Once your application is approved by an administrator, you
                      will be able to create keys here.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          )}
        </WorkspacePage>
      </IdentityShell>
    </Protected>
  );
}
