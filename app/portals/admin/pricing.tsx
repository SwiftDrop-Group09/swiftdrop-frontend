import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, CheckCircle2, AlertCircle, Filter, DollarSign } from 'lucide-react';
import { useIdentity } from '~/features/identity/session';
import { IdentityShell, Protected } from '~/features/identity/components';
import { AdminNav } from '~/features/admin-delivery/admin-nav';
import { createAdminDeliveryApi, AdminDeliveryError } from '~/features/admin-delivery/api';
import {
  parcelSizes,
  type ParcelSize,
  type PricingTierInput,
} from '~/features/admin-delivery/contracts';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '~/shared/components/ui/card';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Badge } from '~/shared/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '~/shared/components/ui/alert';
import { Checkbox } from '~/shared/components/ui/checkbox';
import {
  NativeSelect,
  NativeSelectOption,
} from '~/shared/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/shared/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';

export default function AdminPricingRoute() {
  const { session } = useIdentity();
  const api = useMemo(() => createAdminDeliveryApi(session), [session]);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [formZoneId, setFormZoneId] = useState('');
  const [formSize, setFormSize] = useState<ParcelSize>('Small');
  const [formVersion, setFormVersion] = useState('v1');
  const [formBaseRate, setFormBaseRate] = useState('450.00');
  const [formPerKgRate, setFormPerKgRate] = useState('60.00');
  const [formIsActive, setFormIsActive] = useState(true);

  const zonesQuery = useQuery({
    queryKey: ['admin-zones-all'],
    queryFn: () => api.listZones(1, 100),
  });

  const pricingQuery = useQuery({
    queryKey: ['admin-pricing', page, selectedZoneFilter],
    queryFn: () => api.listPricingTiers(page, 20, selectedZoneFilter || undefined),
  });

  const createMutation = useMutation({
    mutationFn: (input: PricingTierInput) => api.createPricingTier(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pricing'] });
      setIsDialogOpen(false);
      setSuccessMsg('Pricing tier created successfully.');
      setErrorMsg(null);
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof AdminDeliveryError ? err.message : 'Failed to create pricing tier.');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updatePricingTierStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pricing'] });
      setSuccessMsg('Pricing tier status updated.');
      setErrorMsg(null);
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof AdminDeliveryError ? err.message : 'Failed to update status.');
    },
  });

  function openCreate() {
    setErrorMsg(null);
    if (zonesQuery.data?.items && zonesQuery.data.items.length > 0 && !formZoneId) {
      setFormZoneId(zonesQuery.data.items[0].id);
    }
    setIsDialogOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const base = parseFloat(formBaseRate);
    const perKg = parseFloat(formPerKgRate);

    if (isNaN(base) || base < 0) {
      setErrorMsg('Base rate must be a valid non-negative number.');
      return;
    }
    if (isNaN(perKg) || perKg < 0) {
      setErrorMsg('Per-kg rate must be a valid non-negative number.');
      return;
    }

    createMutation.mutate({
      zoneId: formZoneId,
      size: formSize,
      pricingVersion: formVersion.trim(),
      baseRate: base,
      perKgRate: perKg,
      currency: 'LKR',
      isActive: formIsActive,
    });
  }

  return (
    <IdentityShell>
      <Protected admin>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Pricing Tiers Configuration</h1>
              <p className="text-muted-foreground text-sm">
                Configure tariff rates by delivery zone, size brackets, and per-kg incremental weights.
              </p>
            </div>
            <Button onClick={openCreate} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Pricing Tier
            </Button>
          </div>

          <AdminNav />

          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Pricing Configuration Error</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="border-green-500 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* Pricing Formula Explainer Banner */}
          <Card className="bg-muted/40">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Pricing Formula & Audit Rules</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-mono font-medium">Total = BaseRate(Zone, Size, Version) + PerKgRate &times; max(0, WeightKg &minus; 1)</span>.
                The recipient delivery address zone selects the pricing tier. Rates are immutable once referenced in customer bookings; create a new version to update pricing.
              </p>
            </CardContent>
          </Card>

          {/* Pricing Tiers Table Card */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-lg">Configured Pricing Tiers</CardTitle>
                <CardDescription>
                  Active and legacy tariff versions mapped to delivery zones and parcel sizes.
                </CardDescription>
              </div>

              {zonesQuery.data?.items && (
                <div className="flex items-center gap-2 max-w-xs">
                  <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                  <NativeSelect
                    size="sm"
                    value={selectedZoneFilter}
                    onChange={(e) => {
                      setSelectedZoneFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <NativeSelectOption value="">All Delivery Zones</NativeSelectOption>
                    {zonesQuery.data.items.map((z) => (
                      <NativeSelectOption key={z.id} value={z.id}>
                        {z.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {pricingQuery.isLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading pricing tiers...</p>
              ) : pricingQuery.data?.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No pricing tiers match the selected criteria.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone Name</TableHead>
                      <TableHead>Size Category</TableHead>
                      <TableHead>Tariff Version</TableHead>
                      <TableHead className="text-right">Base Rate (LKR)</TableHead>
                      <TableHead className="text-right">Per Kg Rate (LKR)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pricingQuery.data?.items.map((tier) => (
                      <TableRow key={tier.id}>
                        <TableCell className="font-medium">{tier.zoneName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tier.size}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {tier.pricingVersion}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {tier.baseRate.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {tier.perKgRate.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tier.isActive ? 'default' : 'secondary'}>
                            {tier.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={toggleStatusMutation.isPending}
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: tier.id,
                                isActive: !tier.isActive,
                              })
                            }
                          >
                            {tier.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {pricingQuery.data && pricingQuery.data.totalCount > 20 && (
                <div className="flex items-center justify-between pt-4">
                  <Button
                    disabled={page <= 1}
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {Math.ceil(pricingQuery.data.totalCount / 20)}
                  </span>
                  <Button
                    disabled={page * 20 >= pricingQuery.data.totalCount}
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dialog Modal for Adding Pricing Tier using shadcn Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Pricing Tier</DialogTitle>
                <DialogDescription>
                  Define base and incremental rates for a delivery zone and package size bracket.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSave} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pricingZone">Delivery Zone *</Label>
                  <NativeSelect
                    id="pricingZone"
                    value={formZoneId}
                    onChange={(e) => setFormZoneId(e.target.value)}
                    required
                  >
                    <NativeSelectOption value="">Select a zone...</NativeSelectOption>
                    {zonesQuery.data?.items.map((z) => (
                      <NativeSelectOption key={z.id} value={z.id}>
                        {z.name} ({z.city ?? 'General'})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pricingSize">Parcel Size *</Label>
                    <NativeSelect
                      id="pricingSize"
                      value={formSize}
                      onChange={(e) => setFormSize(e.target.value as ParcelSize)}
                    >
                      {parcelSizes.map((size) => (
                        <NativeSelectOption key={size} value={size}>
                          {size}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pricingVersion">Pricing Version *</Label>
                    <Input
                      id="pricingVersion"
                      value={formVersion}
                      onChange={(e) => setFormVersion(e.target.value)}
                      placeholder="e.g. v1, v2"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pricingBase">Base Rate (LKR) *</Label>
                    <Input
                      id="pricingBase"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formBaseRate}
                      onChange={(e) => setFormBaseRate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pricingPerKg">Per Kg Rate (LKR) *</Label>
                    <Input
                      id="pricingPerKg"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formPerKgRate}
                      onChange={(e) => setFormPerKgRate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="tierActive"
                    checked={formIsActive}
                    onCheckedChange={(checked) => setFormIsActive(Boolean(checked))}
                  />
                  <Label htmlFor="tierActive" className="text-sm font-normal cursor-pointer">
                    Tier is active for new customer booking quotes
                  </Label>
                </div>

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    Create Tier
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Protected>
    </IdentityShell>
  );
}
