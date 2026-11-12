import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Pencil, CheckCircle2, AlertCircle } from 'lucide-react';
import { useIdentity } from '~/features/identity/session';
import { IdentityShell, Protected } from '~/features/identity/components';
import {
  createAdminDeliveryApi,
  AdminDeliveryError,
} from '~/features/admin-delivery/api';
import type { Zone, ZoneInput } from '~/features/admin-delivery/contracts';
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
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '~/shared/components/ui/alert';
import { Checkbox } from '~/shared/components/ui/checkbox';
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

export default function AdminZonesRoute() {
  const { session, user, restoring } = useIdentity();
  const enabled = !restoring && !!user?.roles.includes('Admin');
  const api = useMemo(() => createAdminDeliveryApi(session), [session]);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formPostalCodes, setFormPostalCodes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const zonesQuery = useQuery({
    queryKey: ['admin-zones', user?.id, page],
    enabled,
    queryFn: () => api.listZones(page, 20),
  });

  const summaryQuery = useQuery({
    queryKey: ['admin-zone-summary', user?.id],
    enabled,
    queryFn: () => api.getZoneSummary(),
  });

  const createMutation = useMutation({
    mutationFn: (input: ZoneInput) => api.createZone(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin-zones', user?.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ['admin-zone-summary', user?.id],
      });
      setIsDialogOpen(false);
      resetForm();
      setSuccessMsg('Delivery zone created successfully.');
      setErrorMsg(null);
    },
    onError: (err: unknown) => {
      setErrorMsg(
        err instanceof AdminDeliveryError
          ? err.message
          : 'Failed to create zone.',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ZoneInput }) =>
      api.updateZone(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin-zones', user?.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ['admin-zone-summary', user?.id],
      });
      setIsDialogOpen(false);
      setEditingZone(null);
      resetForm();
      setSuccessMsg('Delivery zone updated successfully.');
      setErrorMsg(null);
    },
    onError: (err: unknown) => {
      setErrorMsg(
        err instanceof AdminDeliveryError
          ? err.message
          : 'Failed to update zone.',
      );
    },
  });

  function resetForm() {
    setFormName('');
    setFormCity('');
    setFormPostalCodes('');
    setFormIsActive(true);
  }

  function openCreate() {
    resetForm();
    setEditingZone(null);
    setErrorMsg(null);
    setIsDialogOpen(true);
  }

  function openEdit(zone: Zone) {
    setErrorMsg(null);
    setEditingZone(zone);
    setFormName(zone.name);
    setFormCity(zone.city ?? '');
    setFormPostalCodes(zone.servicePostalCodes.join(', '));
    setFormIsActive(zone.isActive);
    setIsDialogOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const codes = formPostalCodes
      .split(/[,\s]+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const input: ZoneInput = {
      name: formName.trim(),
      city: formCity.trim() || undefined,
      servicePostalCodes: codes,
      isActive: formIsActive,
      expectedVersion: editingZone?.version,
    };

    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  return (
    <IdentityShell>
      <Protected admin>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Delivery Zones Configuration
              </h1>
              <p className="text-muted-foreground text-sm">
                Define geographic service regions, postal coverage codes, and
                real-time operational boundaries.
              </p>
            </div>
            <Button onClick={openCreate} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Delivery Zone
            </Button>
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Configuration Error</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="">
              <CheckCircle2 className="h-4 w-4 text-foreground" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* Operational Load Overview */}
          {summaryQuery.data && summaryQuery.data.zones.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Zone Operational Load
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {summaryQuery.data.zones.map((item) => (
                  <Card key={item.zoneId}>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold">
                          {item.name}
                        </CardTitle>
                        <Badge variant="outline">{item.total} Parcels</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1.5 pt-1">
                        <span>
                          Created: {item.statusCounts['Created'] ?? 0}
                        </span>
                        <span>
                          Assigned: {item.statusCounts['Assigned'] ?? 0}
                        </span>
                        <span>
                          In Transit: {item.statusCounts['InTransit'] ?? 0}
                        </span>
                        <span>
                          Delivered: {item.statusCounts['Delivered'] ?? 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Configured Zones Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Configured Delivery Zones
              </CardTitle>
              <CardDescription>
                Service zones partition operational territories and determine
                courier assignment boundaries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {zonesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Loading delivery zones...
                </p>
              ) : zonesQuery.data?.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No delivery zones configured yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone Name</TableHead>
                      <TableHead>City / Region</TableHead>
                      <TableHead>Service Postal Codes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zonesQuery.data?.items.map((zone) => (
                      <TableRow key={zone.id}>
                        <TableCell className="font-medium">
                          {zone.name}
                        </TableCell>
                        <TableCell>{zone.city ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {zone.servicePostalCodes.length > 0 ? (
                              zone.servicePostalCodes.map((code) => (
                                <Badge
                                  key={code}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {code}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                All General
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={zone.isActive ? 'default' : 'secondary'}
                          >
                            {zone.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(zone)}
                            className="gap-1.5"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {zonesQuery.data && zonesQuery.data.totalCount > 20 && (
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
                    Page {page} of {Math.ceil(zonesQuery.data.totalCount / 20)}
                  </span>
                  <Button
                    disabled={page * 20 >= zonesQuery.data.totalCount}
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

          {/* Dialog Modal for Create or Edit Zone using shadcn Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingZone
                    ? `Edit Zone: ${editingZone.name}`
                    : 'Create Delivery Zone'}
                </DialogTitle>
                <DialogDescription>
                  Configure zone attributes and serviced postal codes. Postal
                  codes cannot overlap with active zones.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSave} className="space-y-4 py-2">
                {errorMsg && (
                  <Alert variant="destructive">
                    <AlertTitle>Unable to save zone</AlertTitle>
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="zoneName">Zone Name *</Label>
                  <Input
                    id="zoneName"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Colombo Metro"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="zoneCity">Coarse City / District</Label>
                  <Input
                    id="zoneCity"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="e.g. Colombo"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="zonePostal">
                    Service Postal Codes (comma or space separated)
                  </Label>
                  <Input
                    id="zonePostal"
                    value={formPostalCodes}
                    onChange={(e) => setFormPostalCodes(e.target.value)}
                    placeholder="00100, 00200, 00300"
                  />
                  <p className="text-xs text-muted-foreground">
                    Active postal codes are mutually exclusive across active
                    service zones.
                  </p>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="zoneActive"
                    checked={formIsActive}
                    onCheckedChange={(checked) =>
                      setFormIsActive(Boolean(checked))
                    }
                  />
                  <Label
                    htmlFor="zoneActive"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Zone is active for booking quote calculation and courier
                    dispatch
                  </Label>
                </div>

                <DialogFooter className="pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    {editingZone ? 'Save Changes' : 'Create Zone'}
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
