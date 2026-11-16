import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from './session';
import type { Profile } from './contracts';
import { createAdminDeliveryApi } from '~/features/admin-delivery/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/shared/components/ui/dialog';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Checkbox } from '~/shared/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/shared/components/ui/select';
import { Alert } from '~/shared/components/ui/alert';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';

interface CourierOpsDialogProps {
  profile: Profile;
  close: () => void;
  saved: (message: string) => void;
}

export function CourierOpsDialog({ profile, close, saved }: CourierOpsDialogProps) {
  const { session } = useIdentity();
  const queries = useQueryClient();
  const api = createAdminDeliveryApi(session);

  const [vehicleType, setVehicleType] = useState('Motorcycle');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [maxWeightKg, setMaxWeightKg] = useState('30.00');
  const [capacity, setCapacity] = useState('10');
  const [onDuty, setOnDuty] = useState(false);
  const [active, setActive] = useState(true);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const courierQuery = useQuery({
    queryKey: ['admin-courier-ops', profile.id],
    queryFn: async () => {
      try {
        return await api.getAdminCourier(profile.id);
      } catch {
        // Return default operational state if courier record not yet initialized in delivery db
        return null;
      }
    },
  });

  const zonesQuery = useQuery({
    queryKey: ['admin-zones-list'],
    queryFn: () => api.listZones(1, 100),
  });

  useEffect(() => {
    if (courierQuery.data) {
      setVehicleType(courierQuery.data.vehicleType);
      setVehicleNumber(courierQuery.data.vehicleNumber || '');
      setMaxWeightKg(String(courierQuery.data.maxWeightKg));
      setCapacity(String(courierQuery.data.capacity));
      setOnDuty(courierQuery.data.onDuty);
      setActive(courierQuery.data.active);
      setSelectedZones(courierQuery.data.zoneIds || []);
    }
  }, [courierQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsedCapacity = parseInt(capacity, 10);
      const parsedWeight = parseFloat(maxWeightKg);
      if (isNaN(parsedCapacity) || parsedCapacity < 1) {
        throw new Error('Capacity must be at least 1.');
      }
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        throw new Error('Max weight must be greater than 0 kg.');
      }

      await api.updateAdminCourier(profile.id, {
        active,
        onDuty,
        capacity: parsedCapacity,
        vehicleType,
        vehicleNumber: vehicleNumber.trim() || null,
        maxWeightKg: parsedWeight,
        zoneIds: selectedZones,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queries.invalidateQueries({ queryKey: ['courier-directory'] }),
        queries.invalidateQueries({ queryKey: ['dispatch-workload'] }),
        queries.invalidateQueries({ queryKey: ['dispatch-assignment-options'] }),
        queries.invalidateQueries({ queryKey: ['admin-courier-ops', profile.id] }),
      ]);
      saved(`Updated courier operations for ${profile.fullName}.`);
      close();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to update courier operations.');
    },
  });

  const toggleZone = (zoneId: string) => {
    setSelectedZones((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId],
    );
  };

  const isLoading = courierQuery.isLoading || zonesQuery.isLoading;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Courier Vehicle & Zone Operations</DialogTitle>
          <DialogDescription>
            Configure operational parameters, vehicle capacity, and delivery zones for{' '}
            <strong>{profile.fullName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <WorkspaceLoading label="Loading operational profile..." />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              mutation.mutate();
            }}
            className="space-y-4"
          >
            {formError && <Alert variant="destructive">{formError}</Alert>}

            <div className="space-y-2">
              <Label htmlFor="vehicleType">Vehicle Type</Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger id="vehicleType">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bicycle">Bicycle (Light cargo, up to 15 kg)</SelectItem>
                  <SelectItem value="Motorcycle">Motorcycle (Standard, up to 35 kg)</SelectItem>
                  <SelectItem value="Car">Car (Standard parcel trunk, up to 100 kg)</SelectItem>
                  <SelectItem value="Van">Van (Large cargo, up to 500 kg)</SelectItem>
                  <SelectItem value="Truck">Truck (Heavy cargo, up to 2000 kg)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="vehicleNumber">Plate / Vehicle No.</Label>
                <Input
                  id="vehicleNumber"
                  placeholder="e.g. WP-CAD-1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  maxLength={32}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxWeight">Max Cargo (kg)</Label>
                <Input
                  id="maxWeight"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="5000"
                  value={maxWeightKg}
                  onChange={(e) => setMaxWeightKg(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Daily Max Parcel Capacity</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                max="100"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Maximum active parcel deliveries allowed on a single service date.
              </p>
            </div>

            <div className="flex gap-4 pt-1">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={onDuty}
                  onCheckedChange={(v) => setOnDuty(v === true)}
                />
                On Duty (Clocked in)
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={active}
                  onCheckedChange={(v) => setActive(v === true)}
                />
                Active Account
              </Label>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label>Assigned Delivery Zones</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Dispatcher can only assign parcels located in these zones to this courier.
              </p>
              {zonesQuery.data?.items.length ? (
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                  {zonesQuery.data.items.map((zone) => (
                    <Label
                      key={zone.id}
                      className="flex items-center gap-2 text-sm font-normal cursor-pointer py-1 hover:bg-muted/50 px-1 rounded"
                    >
                      <Checkbox
                        checked={selectedZones.includes(zone.id)}
                        onCheckedChange={() => toggleZone(zone.id)}
                      />
                      <span>
                        <strong>{zone.name}</strong>
                        {zone.city ? ` (${zone.city})` : ''}
                      </span>
                    </Label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No zones created yet.</p>
              )}
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={close} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Save Operations'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

