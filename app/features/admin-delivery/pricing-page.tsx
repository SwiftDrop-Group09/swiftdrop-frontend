import { Fragment, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Info,
  LoaderCircle,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { AdminWorkspace } from '~/features/identity/admin-workspace';
import { IdentityShell, Protected } from '~/features/identity/components';
import { useIdentity } from '~/features/identity/session';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/shared/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/shared/components/ui/alert-dialog';
import { AdminDeliveryError, createAdminDeliveryApi } from './api';
import {
  parcelSizes,
  type PricingTier,
  type PricingTierInput,
} from './contracts';
import { PricingVersions } from './pricing-versions';
import { formatRate, PricingEditor } from './pricing-editor';
import { PricingZonePicker } from './pricing-zone-picker';

export default function AdminPricingPage() {
  return (
    <IdentityShell>
      <Protected admin>
        <PricingContent />
      </Protected>
    </IdentityShell>
  );
}

function PricingContent() {
  const { session, user } = useIdentity();
  const api = useMemo(() => createAdminDeliveryApi(session), [session]);
  const queries = useQueryClient();
  const [params, setParams] = useSearchParams();
  const rawZoneId = params.get('zoneId') ?? '';
  const zoneId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      rawZoneId,
    )
      ? rawZoneId
      : '';
  const [paging, setPaging] = useState({ zoneId, page: 1 });
  const page = paging.zoneId === zoneId ? paging.page : 1;
  const [selection, setSelection] = useState<
    { id: string; name: string } | undefined
  >();
  const [editor, setEditor] = useState<{
    source?: PricingTier;
    initialZone?: { id: string; name: string };
  } | null>(null);
  const [statusTier, setStatusTier] = useState<PricingTier | null>(null);
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const tiers = useQuery({
    queryKey: ['admin-pricing', user!.id, 'overview', page, zoneId],
    queryFn: ({ signal }) =>
      api.getPricingOverview(page, 20, zoneId || undefined, signal),
    retry: false,
  });
  const zoneName =
    selection?.id === zoneId
      ? selection.name
      : tiers.data?.items.find((tier) => tier.zoneId === zoneId)?.zoneName;
  const selectedZone = zoneId
    ? { id: zoneId, name: zoneName || 'Selected delivery zone' }
    : undefined;
  function restoreFocus(saved = false) {
    requestAnimationFrame(() => {
      const target =
        !saved && opener.current?.isConnected
          ? opener.current
          : addButton.current;
      target?.focus();
    });
  }
  function invalidate() {
    for (const key of ['admin-pricing', 'admin-zone-summary'])
      void queries.invalidateQueries({ queryKey: [key, user!.id] });
  }
  const create = useMutation({
    retry: false,
    mutationFn: (input: PricingTierInput) => api.createPricingTier(input),
    onSuccess: (tier) => {
      setEditor(null);
      setNotice(`Pricing tier ${tier.pricingVersion} created successfully.`);
      setPaging({ zoneId, page: 1 });
      invalidate();
      restoreFocus(true);
    },
  });
  const status = useMutation({
    retry: false,
    mutationFn: (tier: PricingTier) =>
      api.updatePricingTierStatus(tier.id, !tier.isActive, tier.version),
    onSuccess: (tier) => {
      setStatusTier(null);
      setNotice(
        `Pricing tier ${tier.pricingVersion} ${tier.isActive ? 'activated' : 'deactivated'} successfully.`,
      );
      invalidate();
      restoreFocus();
    },
  });
  function openEditor(
    button: HTMLButtonElement,
    source?: PricingTier,
    zone = selectedZone,
  ) {
    opener.current = button;
    create.reset();
    setNotice('');
    setEditor({ source, initialZone: zone });
  }
  return (
    <AdminWorkspace
      title="Pricing tiers"
      actions={
        <>
          <Button
            variant="outline"
            disabled={tiers.isFetching}
            onClick={() =>
              void queries.invalidateQueries({
                queryKey: ['admin-pricing', user!.id],
              })
            }
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
          <Button
            ref={addButton}
            onClick={(event) => openEditor(event.currentTarget)}
          >
            <Plus aria-hidden="true" />
            Add pricing tier
          </Button>
        </>
      }
    >
      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <Card className="min-w-0">
        <CardHeader className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="text-base">Active rates by zone</CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="How pricing works"
                >
                  <Info aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[min(24rem,calc(100vw-2rem))] space-y-3 text-sm"
              >
                <h2 className="font-semibold">How pricing works</h2>
                <p>Base rate + additional rate x weight above 1 kg.</p>
                <p className="text-muted-foreground">
                  The delivery address zone selects the tariff. Only one version
                  per zone and parcel size can be active. Activating another
                  version replaces the previous active version.
                </p>
                <p className="text-muted-foreground">
                  Saved rates are retained. Create a new version to change
                  pricing; existing booking price snapshots are preserved.
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <div className="w-full sm:w-72">
            <PricingZonePicker
              value={zoneId}
              valueLabel={zoneName}
              label="Filter by delivery zone"
              allowAll
              onChange={(zone) => {
                setSelection(
                  zone ? { id: zone.id, name: zone.name } : undefined,
                );
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  if (zone) next.set('zoneId', zone.id);
                  else next.delete('zoneId');
                  return next;
                });
                setPaging({ zoneId: zone?.id ?? '', page: 1 });
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          {zoneId && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="max-w-full gap-1 whitespace-normal break-words py-1 pl-3 pr-1"
              >
                Zone: {zoneName || 'Selected delivery zone'}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  aria-label="Clear zone filter"
                  onClick={() =>
                    setParams((current) => {
                      const next = new URLSearchParams(current);
                      next.delete('zoneId');
                      return next;
                    })
                  }
                >
                  <X aria-hidden="true" />
                </Button>
              </Badge>
            </div>
          )}
          {tiers.isPending ? (
            <WorkspaceLoading label="Loading pricing tiers..." />
          ) : tiers.isError ? (
            <WorkspaceNotice
              destructive
              title="Unable to load pricing tiers"
              description="Pricing records could not be loaded. Your configuration is unchanged."
              retry={() => void tiers.refetch()}
              pending={tiers.isFetching}
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground" role="status">
                {tiers.data.totalCount} {zoneId ? 'matching' : 'configured'}{' '}
                delivery zones{' '}
                <span className="mx-1" aria-hidden="true">
                  /
                </span>{' '}
                Rates in LKR
              </p>
              {!tiers.data.items.length ? (
                <WorkspaceNotice
                  title="No delivery zones match the selected criteria."
                  description={
                    zoneId
                      ? 'Clear the zone filter to view configured delivery zones.'
                      : 'Configure a delivery zone before adding pricing tiers.'
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Delivery zone</TableHead>
                      {parcelSizes.map((size) => (
                        <TableHead key={size}>{size}</TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiers.data.items.map((zone) => (
                      <Fragment key={zone.zoneId}>
                        <TableRow>
                          <TableCell className="min-w-48 max-w-72 whitespace-normal">
                            <Button
                              variant="ghost"
                              className="h-auto max-w-full justify-start gap-2 px-2 py-2 text-left whitespace-normal"
                              aria-label={`Show pricing versions for ${zone.zoneName}`}
                              aria-expanded={expanded === zone.zoneId}
                              aria-controls={`versions-${zone.zoneId}`}
                              onClick={() =>
                                setExpanded((current) =>
                                  current === zone.zoneId ? null : zone.zoneId,
                                )
                              }
                            >
                              {expanded === zone.zoneId ? (
                                <ChevronDown
                                  className="shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ChevronRight
                                  className="shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="min-w-0 break-words font-medium">
                                {zone.zoneName}
                              </span>
                            </Button>
                            <div className="flex flex-wrap items-center gap-2 pl-8 text-xs text-muted-foreground">
                              <span>{zone.tierCount} versions</span>
                              {!zone.isZoneActive && (
                                <Badge variant="outline">Zone inactive</Badge>
                              )}
                            </div>
                          </TableCell>
                          {parcelSizes.map((size) => {
                            const active = zone.activeTiers.find(
                              (tier) => tier.size === size,
                            );
                            return (
                              <TableCell key={size} className="min-w-36">
                                {active ? (
                                  <div className="space-y-1">
                                    <p className="font-semibold tabular-nums">
                                      {formatRate(active.baseRate)}
                                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                                        base
                                      </span>
                                    </p>
                                    <p className="text-xs tabular-nums text-muted-foreground">
                                      + {formatRate(active.perKgRate)} / kg
                                      above 1 kg
                                    </p>
                                    <p className="max-w-36 break-all whitespace-normal text-xs text-muted-foreground">
                                      {active.pricingVersion}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    No active tier
                                  </span>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={`Add pricing tier for ${zone.zoneName}`}
                              onClick={(event) =>
                                openEditor(event.currentTarget, undefined, {
                                  id: zone.zoneId,
                                  name: zone.zoneName,
                                })
                              }
                            >
                              <Plus aria-hidden="true" />
                              Add tier
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded === zone.zoneId && (
                          <TableRow
                            id={`versions-${zone.zoneId}`}
                            className="hover:bg-transparent"
                          >
                            <TableCell
                              colSpan={5}
                              className="whitespace-normal p-0"
                            >
                              <PricingVersions
                                zone={zone}
                                onNewVersion={(button, tier) =>
                                  openEditor(button, tier)
                                }
                                onStatus={(button, tier) => {
                                  opener.current = button;
                                  status.reset();
                                  setNotice('');
                                  setStatusTier(tier);
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of{' '}
                  {Math.max(1, Math.ceil(tiers.data.totalCount / 20))}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || tiers.isFetching}
                    onClick={() => setPaging({ zoneId, page: page - 1 })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      page * 20 >= tiers.data.totalCount || tiers.isFetching
                    }
                    onClick={() => setPaging({ zoneId, page: page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {editor && (
        <PricingEditor
          source={editor.source}
          initialZone={editor.initialZone}
          pending={create.isPending}
          error={create.error}
          onSave={(input) => create.mutate(input)}
          onClose={() => {
            setEditor(null);
            restoreFocus();
          }}
        />
      )}
      <AlertDialog
        open={!!statusTier}
        onOpenChange={(open) => {
          if (!open && !status.isPending) {
            setStatusTier(null);
            restoreFocus();
          }
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (status.isPending) event.preventDefault();
          }}
          className="max-h-[calc(100svh-2rem)] overflow-y-auto"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTier?.isActive
                ? 'Deactivate pricing tier?'
                : 'Activate pricing tier?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTier?.isActive
                ? 'New quotes will no longer use this tier. A replacement active tier is required for this zone and parcel size.'
                : 'This tier will replace any active version for the same zone and parcel size.'}{' '}
              Existing booking price snapshots are retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {statusTier && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
              <p className="break-words font-medium">{statusTier.zoneName}</p>
              <p className="break-words text-muted-foreground">
                {statusTier.size} / {statusTier.pricingVersion}
              </p>
              <p className="tabular-nums">
                LKR {formatRate(statusTier.baseRate)} base +{' '}
                {formatRate(statusTier.perKgRate)}/kg above 1 kg
              </p>
            </div>
          )}
          {status.isError && (
            <Alert variant="destructive">
              <AlertTitle>Availability was not changed</AlertTitle>
              <AlertDescription>
                {status.error.message}
                {status.error instanceof AdminDeliveryError &&
                  status.error.code === 'conflict' && (
                    <p>
                      Close this confirmation and refresh the list before trying
                      again.
                    </p>
                  )}
              </AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <Button
              variant="outline"
              disabled={status.isPending}
              onClick={() => {
                setStatusTier(null);
                restoreFocus();
              }}
            >
              Cancel
            </Button>
            {status.isError ? (
              <Button
                variant="outline"
                onClick={() => {
                  setStatusTier(null);
                  void queries.invalidateQueries({
                    queryKey: ['admin-pricing', user!.id],
                  });
                  restoreFocus();
                }}
              >
                Close and refresh
              </Button>
            ) : (
              <Button
                variant={statusTier?.isActive ? 'destructive' : 'default'}
                disabled={status.isPending}
                onClick={() => {
                  if (statusTier) status.mutate(statusTier);
                }}
              >
                {status.isPending && (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                )}
                {status.isPending
                  ? 'Saving...'
                  : statusTier?.isActive
                    ? 'Deactivate tier'
                    : 'Activate tier'}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminWorkspace>
  );
}
