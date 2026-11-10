import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  History,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  Webhook,
} from 'lucide-react';
import {
  createWebhookSchema,
  replayWebhookSchema,
  webhookEvents,
} from './contracts';
import type {
  CreateWebhookInput,
  OneTimeWebhookResponse,
  ReplayWebhookInput,
  WebhookAttemptResponse,
  WebhookEvent,
  WebhookSubscriptionResponse,
} from './contracts';
import { useWebhookApi, WebhookError } from './api';
import { useMerchantApi } from '../merchant/api';
import { IdentityShell, Protected } from '../identity/components';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Textarea } from '~/shared/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
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

export function WebhookScreens() {
  const queryClient = useQueryClient();
  const webhookApi = useWebhookApi();
  const merchantApi = useMerchantApi();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [oneTimeSecret, setOneTimeSecret] =
    useState<OneTimeWebhookResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedWebhook, setSelectedWebhook] =
    useState<WebhookSubscriptionResponse | null>(null);
  const [replayAttempt, setReplayAttempt] =
    useState<WebhookAttemptResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(
    null,
  );

  // 1. Fetch Merchant status to ensure approved
  const { data: business, isLoading: businessLoading } = useQuery({
    queryKey: ['merchant', 'me'],
    queryFn: () => merchantApi.getMyMerchant(),
  });

  // 2. Fetch Subscriptions
  const {
    data: webhooksData,
    isLoading: webhooksLoading,
    error: webhooksError,
  } = useQuery({
    queryKey: ['merchant', 'webhooks'],
    queryFn: () => webhookApi.listWebhooks(1, 50),
    enabled: business?.status === 'Approved',
  });

  // 3. Fetch Attempts for Selected Webhook
  const { data: attemptsData, isLoading: attemptsLoading } = useQuery({
    queryKey: ['merchant', 'webhooks', selectedWebhook?.id, 'attempts'],
    queryFn: () => webhookApi.listAttempts(selectedWebhook!.id, 1, 50),
    enabled: !!selectedWebhook,
  });

  // 4. Create Webhook Mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateWebhookInput) => webhookApi.createWebhook(input),
    onSuccess: (data) => {
      setOneTimeSecret(data);
      setCreateDialogOpen(false);
      setApiError(null);
      void queryClient.invalidateQueries({
        queryKey: ['merchant', 'webhooks'],
      });
    },
    onError: (err: unknown) => {
      setApiError(
        err instanceof WebhookError
          ? err.message
          : 'Failed to register webhook.',
      );
    },
  });

  // 5. Delete Webhook Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhookApi.deleteWebhook(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['merchant', 'webhooks'],
      });
      if (selectedWebhook) {
        setSelectedWebhook(null);
      }
    },
    onError: (err: unknown) => {
      setApiError(
        err instanceof WebhookError ? err.message : 'Failed to delete webhook.',
      );
    },
  });

  // 6. Replay Webhook Mutation
  const replayMutation = useMutation({
    mutationFn: ({
      subId,
      input,
    }: {
      subId: string;
      input: ReplayWebhookInput;
    }) => webhookApi.replayWebhook(subId, input),
    onSuccess: () => {
      setReplayAttempt(null);
      void queryClient.invalidateQueries({
        queryKey: ['merchant', 'webhooks', selectedWebhook?.id, 'attempts'],
      });
    },
    onError: (err: unknown) => {
      setApiError(
        err instanceof WebhookError ? err.message : 'Failed to trigger replay.',
      );
    },
  });

  // 7. Test Webhook Mutation
  const testMutation = useMutation({
    mutationFn: (subId: string) => webhookApi.triggerTestWebhook(subId),
    onSuccess: () => {
      setTestSuccessMessage(
        'Test delivery event sent! Attempt recorded in the history.',
      );
      setApiError(null);
      void queryClient.invalidateQueries({
        queryKey: ['merchant', 'webhooks'],
      });
      if (selectedWebhook) {
        void queryClient.invalidateQueries({
          queryKey: ['merchant', 'webhooks', selectedWebhook.id, 'attempts'],
        });
      }
      setTimeout(() => setTestSuccessMessage(null), 5000);
    },
    onError: (err: unknown) => {
      setApiError(
        err instanceof WebhookError
          ? err.message
          : 'Failed to trigger test webhook.',
      );
    },
  });

  // Registration form state
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([
    'delivery.delivered',
  ]);
  const [createErrors, setCreateErrors] = useState<{
    url?: string;
    events?: string;
  }>({});

  // Replay form state
  const [replayReason, setReplayReason] = useState('');
  const [replayError, setReplayError] = useState<string | null>(null);

  const resetCreateForm = () => {
    setTargetUrl('');
    setSelectedEvents(['delivery.delivered']);
    setCreateErrors({});
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createWebhookSchema.safeParse({
      url: targetUrl,
      events: selectedEvents,
    });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setCreateErrors({
        url: fieldErrors.url?.[0],
        events: fieldErrors.events?.[0],
      });
      return;
    }
    setCreateErrors({});
    createMutation.mutate(result.data);
  };

  const handleReplaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWebhook || !replayAttempt) return;
    const result = replayWebhookSchema.safeParse({ reason: replayReason });
    if (!result.success) {
      setReplayError(
        result.error.flatten().fieldErrors.reason?.[0] ?? 'Reason is required',
      );
      return;
    }
    setReplayError(null);
    replayMutation.mutate({
      subId: selectedWebhook.id,
      input: {
        reason: result.data.reason,
        jobId: replayAttempt.jobId,
      },
    });
  };

  const handleCopySecret = () => {
    if (oneTimeSecret) {
      void navigator.clipboard.writeText(oneTimeSecret.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isApproved = business?.status === 'Approved';

  return (
    <Protected>
      <IdentityShell>
        <div className="space-y-6 max-w-6xl mx-auto py-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link
                  to="/merchant"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Merchant Portal & API Keys
                </Link>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                Delivery Status Webhooks
              </h1>
              <p className="text-muted-foreground text-sm">
                Receive automatic real-time notifications whenever your delivery
                statuses update.
              </p>
            </div>
            {isApproved && !selectedWebhook && (
              <Button
                onClick={() => {
                  resetCreateForm();
                  setApiError(null);
                  setCreateDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Register Webhook
              </Button>
            )}
          </div>

          {/* Status Alert if Not Approved */}
          {!businessLoading && !isApproved && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Business Approval Required</AlertTitle>
              <AlertDescription>
                Only approved merchant businesses can register webhook endpoints
                and receive delivery status dispatches. Your current business
                application status is{' '}
                <strong>{business?.status ?? 'Unregistered'}</strong>.
              </AlertDescription>
            </Alert>
          )}

          {/* Top-level API Error Display */}
          {apiError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Operation Failed</AlertTitle>
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}

          {/* Top-level Test Success Message */}
          {testSuccessMessage && (
            <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
              <Check className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="font-semibold">
                Test Event Dispatched
              </AlertTitle>
              <AlertDescription>{testSuccessMessage}</AlertDescription>
            </Alert>
          )}

          {/* View 1: Attempts Timeline for Selected Webhook */}
          {selectedWebhook ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-2"
                    onClick={() => setSelectedWebhook(null)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Subscriptions
                  </Button>
                  <CardTitle className="text-lg">
                    Delivery Attempts History
                  </CardTitle>
                  <CardDescription className="font-mono text-xs break-all">
                    {selectedWebhook.endpointUrl}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedWebhook.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={testMutation.isPending}
                      onClick={() => {
                        setApiError(null);
                        testMutation.mutate(selectedWebhook.id);
                      }}
                    >
                      <Send className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      {testMutation.isPending
                        ? 'Sending...'
                        : 'Send Test Event'}
                    </Button>
                  )}
                  <Badge
                    variant={selectedWebhook.isActive ? 'default' : 'secondary'}
                  >
                    {selectedWebhook.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {attemptsLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Loading attempts...
                  </p>
                ) : !attemptsData?.items.length ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No delivery attempts recorded for this webhook subscription
                    yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Attempt #</TableHead>
                        <TableHead>Requested At</TableHead>
                        <TableHead>HTTP Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Next Retry</TableHead>
                        <TableHead>Failure Reason</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attemptsData.items.map((attempt) => {
                        const isSuccess =
                          attempt.responseStatusCode !== null &&
                          attempt.responseStatusCode >= 200 &&
                          attempt.responseStatusCode < 300;

                        return (
                          <TableRow key={attempt.id}>
                            <TableCell className="font-medium">
                              #{attempt.attemptNumber}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(attempt.requestedAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {attempt.responseStatusCode ? (
                                <Badge
                                  variant={
                                    isSuccess ? 'default' : 'destructive'
                                  }
                                >
                                  {attempt.responseStatusCode}
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  Timeout / Network
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {attempt.durationMs} ms
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {attempt.nextRetryAt
                                ? new Date(
                                    attempt.nextRetryAt,
                                  ).toLocaleTimeString()
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                              {attempt.failureReason ?? '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {!isSuccess && selectedWebhook.isActive && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs font-medium"
                                  onClick={() => {
                                    setReplayAttempt(attempt);
                                    setReplayReason('');
                                    setReplayError(null);
                                  }}
                                >
                                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                  Replay
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : (
            /* View 2: Webhooks Subscription List */
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Webhook className="w-5 h-5" />
                  Active Subscriptions
                </CardTitle>
                <CardDescription>
                  Your configured webhook endpoints receiving delivery status
                  updates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {webhooksLoading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Loading webhooks...
                  </p>
                ) : webhooksError ? (
                  <p className="text-sm text-destructive py-8 text-center">
                    Unable to load webhooks. Please try again later.
                  </p>
                ) : !webhooksData?.items.length ? (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-muted-foreground text-sm">
                      You haven't configured any webhook endpoints yet.
                    </p>
                    {isApproved && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          resetCreateForm();
                          setApiError(null);
                          setCreateDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Register Your First Webhook
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint URL</TableHead>
                        <TableHead>Subscribed Events</TableHead>
                        <TableHead className="w-20">Version</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="w-28">Created</TableHead>
                        <TableHead className="text-right whitespace-nowrap min-w-[280px]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhooksData.items.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-mono text-xs max-w-sm truncate">
                            {sub.endpointUrl}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-md">
                              {sub.events.map((evt) => (
                                <Badge
                                  key={evt}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {evt}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            v{sub.secretVersion}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={sub.isActive ? 'default' : 'secondary'}
                            >
                              {sub.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(sub.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {sub.isActive && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs font-medium"
                                  disabled={testMutation.isPending}
                                  onClick={() => {
                                    setApiError(null);
                                    testMutation.mutate(sub.id);
                                  }}
                                >
                                  <Send className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                                  Send Test Event
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-medium"
                                onClick={() => setSelectedWebhook(sub)}
                              >
                                <History className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                                View Attempts
                              </Button>
                              {sub.isActive && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Deactivate Webhook"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        'Deactivate this webhook subscription? Unsent jobs will be cancelled.',
                                      )
                                    ) {
                                      deleteMutation.mutate(sub.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="sr-only">Deactivate</span>
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
          )}

          {/* Modal 1: Register Webhook Dialog */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle>Register Webhook Endpoint</DialogTitle>
                <DialogDescription>
                  Enter your endpoint URL and choose which delivery events you
                  wish to receive.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Endpoint URL (HTTPS)</Label>
                  <Input
                    id="url"
                    placeholder="https://api.yourdomain.com/webhooks/swiftdrop"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                  />
                  {createErrors.url && (
                    <p className="text-xs text-destructive">
                      {createErrors.url}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Delivery Events to Subscribe</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-48 overflow-y-auto">
                    {webhookEvents.map((evt) => {
                      const isSelected = selectedEvents.includes(evt);
                      return (
                        <label
                          key={evt}
                          className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setSelectedEvents((prev) =>
                                e.target.checked
                                  ? [...prev, evt]
                                  : prev.filter((x) => x !== evt),
                              );
                            }}
                          />
                          <span className="font-mono">{evt}</span>
                        </label>
                      );
                    })}
                  </div>
                  {createErrors.events && (
                    <p className="text-xs text-destructive">
                      {createErrors.events}
                    </p>
                  )}
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Registering...' : 'Register'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Modal 2: One-Time Signing Secret Reveal */}
          <Dialog
            open={!!oneTimeSecret}
            onOpenChange={(open) => {
              if (!open) setOneTimeSecret(null);
            }}
          >
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                  Webhook Signing Secret Generated
                </DialogTitle>
                <DialogDescription>
                  Store this secret key securely. For your protection, it will{' '}
                  <strong>never be shown again</strong>.
                </DialogDescription>
              </DialogHeader>

              {oneTimeSecret && (
                <div className="space-y-4 py-2">
                  <div className="p-3 bg-muted rounded-md space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Signing Secret Key
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        Version {oneTimeSecret.secretVersion}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <code className="text-xs font-mono break-all bg-background p-2 rounded border flex-1 select-all">
                        {oneTimeSecret.secret}
                      </code>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleCopySecret}
                        className="shrink-0"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-1 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription className="text-xs text-muted-foreground">
                      Use this secret key to verify that incoming webhook
                      notifications are genuinely sent by SwiftDrop.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <DialogFooter>
                <Button onClick={() => setOneTimeSecret(null)}>
                  I have saved my secret
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal 3: Replay Job Confirmation Dialog */}
          <Dialog
            open={!!replayAttempt}
            onOpenChange={(open) => {
              if (!open) setReplayAttempt(null);
            }}
          >
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Manual Webhook Replay
                </DialogTitle>
                <DialogDescription>
                  Resend this delivery notification to your endpoint.
                </DialogDescription>
              </DialogHeader>

              {replayAttempt && selectedWebhook && (
                <form onSubmit={handleReplaySubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Replay (Required)</Label>
                    <Textarea
                      id="reason"
                      placeholder="e.g., Endpoint outage resolved; resending missed notification."
                      rows={3}
                      value={replayReason}
                      onChange={(e) => setReplayReason(e.target.value)}
                    />
                    {replayError && (
                      <p className="text-xs text-destructive">{replayError}</p>
                    )}
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setReplayAttempt(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={replayMutation.isPending}>
                      {replayMutation.isPending
                        ? 'Queuing Replay...'
                        : 'Confirm Replay'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </IdentityShell>
    </Protected>
  );
}
