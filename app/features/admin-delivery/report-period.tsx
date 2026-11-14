import { useId, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/shared/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from '~/shared/components/ui/popover';
import {
  getUtcDatePreset,
  getUtcIsoRange,
  maxDeliveryReportDays,
} from './report-date-range';

export type ReportDates = { startDate: string; endDate: string };
export function formatReportDate(value: string) {
  return new Intl.DateTimeFormat('en-LK', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
}
export function ReportPeriod({
  value,
  onChange,
  onDraftChange,
}: {
  value: ReportDates;
  onChange: (value: ReportDates) => void;
  onDraftChange?: (dirty: boolean) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  function openChange(next: boolean) {
    setOpen(next);
    setDraft(value);
    setInvalid(false);
    onDraftChange?.(false);
  }
  function change(next: ReportDates) {
    setDraft(next);
    setInvalid(false);
    onDraftChange?.(
      next.startDate !== value.startDate || next.endDate !== value.endDate,
    );
  }
  function apply(next: ReportDates) {
    if (!getUtcIsoRange(next.startDate, next.endDate).isValid) {
      setInvalid(true);
      return;
    }
    onChange(next);
    setDraft(next);
    setInvalid(false);
    onDraftChange?.(false);
    setOpen(false);
  }
  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label="Reporting period"
          className="min-w-0 gap-2"
        >
          <CalendarDays className="shrink-0" aria-hidden="true" />
          <span className="truncate">
            {formatReportDate(value.startDate)} -{' '}
            {formatReportDate(value.endDate)}
          </span>
          <span className="text-xs text-muted-foreground">UTC</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(25rem,calc(100vw-2rem))] max-h-[var(--radix-popover-content-available-height)] space-y-4 overflow-y-auto"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-help`}
      >
        <PopoverHeader>
          <PopoverTitle id={`${id}-title`}>Reporting period</PopoverTitle>
          <PopoverDescription id={`${id}-help`}>
            Inclusive UTC dates. Maximum {maxDeliveryReportDays} days.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-wrap gap-2" aria-label="Date presets">
          {[
            { days: 1, label: 'Today' },
            { days: 7, label: 'Last 7 days' },
            { days: 30, label: 'Last 30 days' },
          ].map((preset) => {
            const next = getUtcDatePreset(preset.days);
            const selected =
              value.startDate === next.startDate &&
              value.endDate === next.endDate;
            return (
              <Button
                key={preset.days}
                variant={selected ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={selected}
                onClick={() => apply(next)}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
        <form
          className="space-y-4 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            apply(draft);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${id}-from`}>From (UTC)</Label>
              <Input
                id={`${id}-from`}
                type="date"
                value={draft.startDate}
                aria-invalid={invalid}
                onChange={(event) =>
                  change({ ...draft, startDate: event.target.value })
                }
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`${id}-through`}>Through (UTC)</Label>
              <Input
                id={`${id}-through`}
                type="date"
                value={draft.endDate}
                aria-invalid={invalid}
                onChange={(event) =>
                  change({ ...draft, endDate: event.target.value })
                }
              />
            </div>
          </div>
          {invalid && (
            <Alert variant="destructive">
              <AlertTitle>Invalid reporting period</AlertTitle>
              <AlertDescription>
                Choose valid dates, keep the end date on or after the start
                date, and select no more than {maxDeliveryReportDays} calendar
                days.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => openChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Apply dates</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
