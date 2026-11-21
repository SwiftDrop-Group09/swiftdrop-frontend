import { useEffect, useState } from 'react';
import { Plus, X, LoaderCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '~/shared/components/ui/sheet';
import { Button } from '~/shared/components/ui/button';
import { Badge } from '~/shared/components/ui/badge';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Checkbox } from '~/shared/components/ui/checkbox';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '~/shared/components/ui/alert';
import type { Zone, ZoneInput } from './contracts';
import { AdminDeliveryError } from './api';

export function parsePostalCodes(text: string, existing: string[] = []) {
  const incoming = text
    .split(/[,;\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (incoming.some((value) => !/^[A-Za-z0-9-]{1,32}$/.test(value)))
    throw new Error(
      'Use letters, digits or hyphens for each postal code (up to 32 characters).',
    );
  const codes = [...existing];
  const seen = new Set(codes.map((code) => code.toUpperCase()));
  for (const value of incoming)
    if (!seen.has(value.toUpperCase())) {
      codes.push(value);
      seen.add(value.toUpperCase());
    }
  return codes;
}
export function ZoneEditor({
  zone,
  open,
  pending,
  error,
  onClose,
  onSave,
}: {
  zone: Zone | null;
  open: boolean;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSave: (input: ZoneInput) => void;
}) {
  const [name, setName] = useState(zone?.name ?? '');
  const [city, setCity] = useState(zone?.city ?? '');
  const [codes, setCodes] = useState(zone?.servicePostalCodes ?? []);
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState(zone?.isActive ?? true);
  const [invalid, setInvalid] = useState('');
  const [discard, setDiscard] = useState(false);
  const [review, setReview] = useState(false);
  const dirty =
    name.trim() !== (zone?.name ?? '') ||
    city.trim() !== (zone?.city ?? '') ||
    active !== (zone?.isActive ?? true) ||
    !!draft.trim() ||
    JSON.stringify(codes) !== JSON.stringify(zone?.servicePostalCodes ?? []);
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, open]);
  const requestClose = () => {
    if (pending) return;
    if (dirty) {
      setDiscard(true);
      return;
    }
    onClose();
  };
  const change = () => {
    setReview(false);
    setDiscard(false);
    setInvalid('');
  };
  function add(text = draft) {
    try {
      setCodes(parsePostalCodes(text, codes));
      setDraft('');
      change();
    } catch (error) {
      setInvalid(
        error instanceof Error ? error.message : 'Check postal codes.',
      );
    }
  }
  const fields = error instanceof AdminDeliveryError ? error.errors : undefined;
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!value) requestClose();
      }}
    >
      <SheetContent
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="w-full gap-0 p-0 sm:max-w-xl"
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
            {zone ? 'Edit delivery zone' : 'Add delivery zone'}
          </SheetTitle>
          <SheetDescription>
            Configure service coverage and availability.{' '}
            {zone
              ? `Saved version ${zone.version}.`
              : 'Postal codes stay as text to preserve leading zeros.'}
          </SheetDescription>
        </SheetHeader>
        <form
          aria-busy={pending}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (pending) return;
            setInvalid('');
            if (!name.trim()) {
              setInvalid('Enter a zone name.');
              return;
            }
            let complete;
            try {
              complete = parsePostalCodes(draft, codes);
            } catch (error) {
              setInvalid(
                error instanceof Error ? error.message : 'Check postal codes.',
              );
              return;
            }
            if (zone && active !== zone.isActive && !review) {
              setReview(true);
              return;
            }
            onSave({
              name: name.trim(),
              city: city.trim() || undefined,
              servicePostalCodes: complete,
              isActive: active,
              expectedVersion: zone?.version,
            });
          }}
        >
          <fieldset
            disabled={pending}
            className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6"
          >
            <section aria-labelledby="zone-basics" className="space-y-4">
              <h3 id="zone-basics" className="font-semibold">
                Zone details
              </h3>
              <div className="space-y-2">
                <Label htmlFor="zone-name">Zone name</Label>
                <Input
                  id="zone-name"
                  value={name}
                  maxLength={100}
                  onChange={(event) => {
                    setName(event.target.value);
                    change();
                  }}
                  placeholder="Colombo Central"
                  aria-invalid={!!fields?.name}
                  aria-describedby={
                    fields?.name ? 'zone-name-error' : undefined
                  }
                />
                {fields?.name && (
                  <p id="zone-name-error" className="text-sm text-destructive">
                    {fields.name.join(' ')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone-city">City / region</Label>
                <Input
                  id="zone-city"
                  value={city}
                  maxLength={200}
                  onChange={(event) => {
                    setCity(event.target.value);
                    change();
                  }}
                  placeholder="Colombo"
                />
              </div>
            </section>
            <section
              aria-labelledby="zone-coverage"
              className="space-y-4 border-t pt-6"
            >
              <div>
                <h3 id="zone-coverage" className="font-semibold">
                  Postal coverage
                </h3>
                <p
                  id="postal-help"
                  className="mt-1 text-sm text-muted-foreground"
                >
                  Add one code or paste a list separated by spaces, commas or
                  new lines. For Sri Lanka, use five-digit codes such as 00100.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal-entry">Add postal codes</Label>
                <div className="flex gap-2">
                  <Input
                    id="postal-entry"
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      change();
                    }}
                    onPaste={(event) => {
                      const text = event.clipboardData.getData('text');
                      if (/[,;\s]/.test(text.trim())) {
                        event.preventDefault();
                        setDraft(text);
                        add(text);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault();
                        add();
                      }
                    }}
                    placeholder="00100, 00200"
                    aria-describedby="postal-help postal-error"
                    aria-invalid={!!fields?.servicePostalCodes}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => add()}
                    aria-label="Add postal codes"
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Configured postal codes"
              >
                {codes.map((code) => (
                  <Badge
                    key={code}
                    variant="secondary"
                    className="gap-1 py-1 pl-3 pr-1"
                  >
                    {code}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={`Remove postal code ${code}`}
                      onClick={() => {
                        setCodes((current) =>
                          current.filter((value) => value !== code),
                        );
                        change();
                      }}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {codes.length} postal codes. Codes cannot overlap another active
                zone.
              </p>
              {fields?.servicePostalCodes && (
                <p
                  id="postal-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {fields.servicePostalCodes.join(' ')}
                </p>
              )}
            </section>
            <section
              aria-labelledby="zone-availability"
              className="space-y-3 border-t pt-6"
            >
              <h3 id="zone-availability" className="font-semibold">
                Availability
              </h3>
              <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                <Checkbox
                  checked={active}
                  onCheckedChange={(value) => {
                    setActive(value === true);
                    change();
                  }}
                />
                <span className="space-y-1">
                  <span className="block font-medium">Active zone</span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    Active zones can be selected for new bookings when active
                    pricing is configured. Existing records are retained when a
                    zone is deactivated.
                  </span>
                </span>
              </Label>
            </section>
            {!!error && (
              <Alert variant="destructive">
                <AlertTitle>Changes were not saved</AlertTitle>
                <AlertDescription>
                  {error instanceof Error
                    ? error.message
                    : 'Please try again. Your draft is unchanged.'}
                  {error instanceof AdminDeliveryError &&
                    error.code === 'conflict' &&
                    zone &&
                    !fields?.name && (
                      <p>
                        Your draft is retained. Close the editor, refresh the
                        list and reopen the zone to use its latest saved
                        version.
                      </p>
                    )}
                </AlertDescription>
              </Alert>
            )}
            {invalid && (
              <p role="alert" className="text-sm text-destructive">
                {invalid}
              </p>
            )}
          </fieldset>
          <SheetFooter className="shrink-0 border-t bg-background p-5 sm:p-6">
            {discard ? (
              <Alert>
                <AlertTitle>Discard unsaved changes?</AlertTitle>
                <AlertDescription>
                  <p>Your saved zone will not be changed.</p>
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
                    <AlertTitle>Confirm availability change</AlertTitle>
                    <AlertDescription>
                      {active
                        ? 'This zone will be enabled for new bookings. It also needs active pricing.'
                        : 'This zone will stop accepting new bookings. Existing deliveries and historical configuration will be retained.'}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    aria-live="polite"
                    className="text-xs text-muted-foreground"
                  >
                    {pending
                      ? 'Saving configuration...'
                      : dirty
                        ? 'Unsaved changes'
                        : 'No unsaved changes'}
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
                    <Button
                      type="submit"
                      disabled={pending || (!!zone && !dirty)}
                    >
                      {pending && (
                        <LoaderCircle
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      {pending
                        ? 'Saving...'
                        : review
                          ? 'Confirm and save'
                          : zone
                            ? 'Save changes'
                            : 'Create zone'}
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
