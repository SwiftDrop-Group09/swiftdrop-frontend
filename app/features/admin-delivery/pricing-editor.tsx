import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '~/shared/components/ui/sheet';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Checkbox } from '~/shared/components/ui/checkbox';
import {
  NativeSelect,
  NativeSelectOption,
} from '~/shared/components/ui/native-select';
import { FieldError } from '~/features/identity/components';
import { AdminDeliveryError } from './api';
import {
  parcelSizes,
  pricingTierInputSchema,
  type PricingTier,
  type PricingTierInput,
} from './contracts';
import { PricingZonePicker } from './pricing-zone-picker';

const money = new Intl.NumberFormat('en-LK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const formatRate = (value: number) => money.format(value);
const validRate = (value: string) =>
  /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number.isFinite(Number(value));

export function PricingEditor({
  source,
  initialZone,
  pending,
  error,
  onClose,
  onSave,
}: {
  source?: PricingTier;
  initialZone?: { id: string; name: string };
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (input: PricingTierInput) => void;
}) {
  const initial = {
    zoneId: source?.zoneId ?? initialZone?.id ?? '',
    zoneName: source?.zoneName ?? initialZone?.name ?? '',
    size: source?.size ?? 'Small',
    pricingVersion: '',
    base: source?.baseRate.toFixed(2) ?? '',
    perKg: source?.perKgRate.toFixed(2) ?? '',
    isActive: true,
  };
  const [values, setValues] = useState(initial);
  const [weight, setWeight] = useState('2.5');
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});
  const [discard, setDiscard] = useState(false);
  const [review, setReview] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const errors = {
    ...(error instanceof AdminDeliveryError ? error.errors : undefined),
    ...localErrors,
  };
  const preview =
    validRate(values.base) &&
    validRate(values.perKg) &&
    Number.isFinite(Number(weight)) &&
    Number(weight) > 0
      ? Number(values.base) +
        Number(values.perKg) * Math.max(0, Number(weight) - 1)
      : null;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(next: Partial<typeof values>) {
    setValues((current) => ({ ...current, ...next }));
    setLocalErrors({});
    setReview(false);
    setDiscard(false);
  }
  function requestClose() {
    if (pending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  function fieldError(key: string) {
    return <FieldError message={errors[key]?.join(' ')} />;
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (pending || dirty) {
            event.preventDefault();
            requestClose();
          }
        }}
        onInteractOutside={(event) => {
          if (pending || dirty) {
            event.preventDefault();
            requestClose();
          }
        }}
      >
        <SheetHeader className="border-b p-5 pr-12 sm:p-6">
          <SheetTitle>
            {source ? 'Create new pricing version' : 'Add pricing tier'}
          </SheetTitle>
          <SheetDescription>
            {source
              ? `Based on ${source.zoneName}, ${source.size}, ${source.pricingVersion}. The original tier is retained.`
              : 'Set rates for a delivery zone and parcel size. Currency is LKR.'}
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (pending) return;
            const invalid: Record<string, string[]> = {};
            if (!validRate(values.base))
              invalid.baseRate = [
                'Enter a non-negative amount with up to two decimal places.',
              ];
            if (!validRate(values.perKg))
              invalid.perKgRate = [
                'Enter a non-negative amount with up to two decimal places.',
              ];
            const parsed = pricingTierInputSchema.safeParse({
              zoneId: values.zoneId,
              size: values.size,
              pricingVersion: values.pricingVersion.trim(),
              baseRate: Number(values.base),
              perKgRate: Number(values.perKg),
              currency: 'LKR',
              isActive: values.isActive,
            });
            if (!parsed.success)
              for (const issue of parsed.error.issues)
                invalid[String(issue.path[0])] = [issue.message];
            setLocalErrors(invalid);
            if (Object.keys(invalid).length || !parsed.success) return;
            if (values.isActive && !review) {
              setReview(true);
              return;
            }
            onSave(parsed.data);
          }}
        >
          <fieldset
            disabled={pending}
            className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6"
          >
            <section aria-labelledby="tier-scope" className="space-y-4">
              <h3 id="tier-scope" className="font-semibold">
                Zone and version
              </h3>
              <div className="space-y-2">
                <Label>Delivery zone</Label>
                <PricingZonePicker
                  value={values.zoneId}
                  valueLabel={values.zoneName}
                  label="Delivery zone for pricing tier"
                  disabled={pending}
                  onChange={(zone) =>
                    change({
                      zoneId: zone?.id ?? '',
                      zoneName: zone?.name ?? '',
                    })
                  }
                />
                {fieldError('zoneId')}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tier-size">Parcel size</Label>
                  <NativeSelect
                    id="tier-size"
                    value={values.size}
                    onChange={(event) =>
                      change({ size: event.target.value as typeof values.size })
                    }
                  >
                    {parcelSizes.map((size) => (
                      <NativeSelectOption key={size} value={size}>
                        {size}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {fieldError('size')}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tier-version">Pricing version</Label>
                  <Input
                    id="tier-version"
                    value={values.pricingVersion}
                    placeholder="e.g. 2026-11"
                    aria-invalid={!!errors.pricingVersion}
                    onChange={(event) =>
                      change({ pricingVersion: event.target.value })
                    }
                  />
                  {fieldError('pricingVersion')}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Each zone, parcel size and version combination must be unique.
                Create a new version to change saved rates.
              </p>
            </section>
            <section
              aria-labelledby="tier-rates"
              className="space-y-4 border-t pt-6"
            >
              <h3 id="tier-rates" className="font-semibold">
                Rates in LKR
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tier-base">Base rate</Label>
                  <Input
                    id="tier-base"
                    inputMode="decimal"
                    value={values.base}
                    placeholder="0.00"
                    aria-invalid={!!errors.baseRate}
                    onChange={(event) => change({ base: event.target.value })}
                  />
                  {fieldError('baseRate')}
                  <p className="text-xs text-muted-foreground">
                    Covers the first kilogram.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tier-perkg">Additional rate per kg</Label>
                  <Input
                    id="tier-perkg"
                    inputMode="decimal"
                    value={values.perKg}
                    placeholder="0.00"
                    aria-invalid={!!errors.perKgRate}
                    onChange={(event) => change({ perKg: event.target.value })}
                  />
                  {fieldError('perKgRate')}
                  <p className="text-xs text-muted-foreground">
                    Applies to weight above 1 kg.
                  </p>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-medium">Rate preview</h4>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="preview-weight">Weight (kg)</Label>
                    <Input
                      id="preview-weight"
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="w-24"
                      value={weight}
                      onChange={(event) => setWeight(event.target.value)}
                    />
                  </div>
                </div>
                <p
                  className="text-2xl font-semibold tabular-nums"
                  role="status"
                  aria-label="Rate preview total"
                >
                  {preview !== null && Number.isFinite(preview)
                    ? `LKR ${formatRate(preview)}`
                    : 'Enter valid rates and weight'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Base + additional rate x weight above 1 kg. This is a preview;
                  booking quotes are calculated by Delivery.
                </p>
              </div>
            </section>
            <section
              aria-labelledby="tier-availability"
              className="space-y-3 border-t pt-6"
            >
              <h3 id="tier-availability" className="font-semibold">
                Availability
              </h3>
              <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                <Checkbox
                  checked={values.isActive}
                  onCheckedChange={(value) =>
                    change({ isActive: value === true })
                  }
                />
                <span className="space-y-1">
                  <span className="block font-medium">
                    Activate for new quotes
                  </span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    Replaces the active tier for this zone and parcel size.
                    Leave unchecked to save an inactive version.
                  </span>
                </span>
              </Label>
            </section>
            {!!error && (
              <Alert variant="destructive">
                <AlertTitle>Pricing tier was not saved</AlertTitle>
                <AlertDescription>
                  {error instanceof Error
                    ? error.message
                    : 'Please try again. Your draft is unchanged.'}
                </AlertDescription>
              </Alert>
            )}
          </fieldset>
          <SheetFooter className="shrink-0 border-t bg-background p-5 sm:p-6">
            {discard ? (
              <Alert>
                <AlertTitle>Discard unsaved changes?</AlertTitle>
                <AlertDescription>
                  <p>No pricing tier has been created.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDiscard(false)}
                    >
                      Keep editing
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={onClose}
                    >
                      Discard changes
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {review && (
                  <Alert>
                    <AlertTitle>Confirm active pricing</AlertTitle>
                    <AlertDescription>
                      <strong className="break-words">
                        {values.zoneName || 'Selected zone'} / {values.size} /{' '}
                        {values.pricingVersion.trim()}
                      </strong>
                      <p>
                        This version will replace any active tier for the same
                        zone and size. Existing booking price snapshots are
                        retained.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {pending
                      ? 'Saving pricing...'
                      : dirty
                        ? 'Unsaved changes'
                        : 'Configure a new pricing version'}
                  </p>
                  <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={requestClose}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={pending}>
                      {pending && (
                        <LoaderCircle
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      {pending
                        ? 'Saving...'
                        : review
                          ? 'Confirm and create'
                          : 'Create tier'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
