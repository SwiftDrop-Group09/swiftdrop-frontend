import { useId, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '~/shared/components/ui/button';
import { Calendar } from '~/shared/components/ui/calendar';
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
} from '~/shared/lib/report-date-range';

export type ReportDates = { startDate: string; endDate: string };
type ReportPeriodProps = {
  onDraftChange?: (dirty: boolean) => void;
  inputMode?: 'native' | 'calendar';
} & (
  | {
      allowAllDates?: false;
      value: ReportDates;
      onChange: (value: ReportDates) => void;
    }
  | {
      allowAllDates: true;
      value: ReportDates | null;
      onChange: (value: ReportDates | null) => void;
    }
);

export function formatReportDate(value: string) {
  return new Intl.DateTimeFormat('en-LK', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
}
export function ReportPeriod(props: ReportPeriodProps) {
  const { value, onChange, onDraftChange, inputMode = 'native' } = props;
  const id = useId();
  const [open, setOpen] = useState(false);
  const emptyDates = { startDate: '', endDate: '' };
  const [draft, setDraft] = useState(value ?? emptyDates);
  const [invalid, setInvalid] = useState(false);
  function openChange(next: boolean) {
    setOpen(next);
    setDraft(value ?? emptyDates);
    setInvalid(false);
    onDraftChange?.(false);
  }
  function change(next: ReportDates) {
    setDraft(next);
    setInvalid(false);
    onDraftChange?.(
      next.startDate !== (value?.startDate ?? '') ||
        next.endDate !== (value?.endDate ?? ''),
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
            {value
              ? `${formatReportDate(value.startDate)} - ${formatReportDate(value.endDate)}`
              : 'All booking dates'}
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
              value?.startDate === next.startDate &&
              value?.endDate === next.endDate;
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
              <Label id={`${id}-from-label`} htmlFor={`${id}-from`}>
                From (UTC)
              </Label>
              {inputMode === 'calendar' ? (
                <PeriodDatePicker
                  id={`${id}-from`}
                  value={draft.startDate}
                  invalid={invalid}
                  errorId={`${id}-error`}
                  onChange={(startDate) => change({ ...draft, startDate })}
                />
              ) : (
                <Input
                  id={`${id}-from`}
                  type="date"
                  value={draft.startDate}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${id}-error` : undefined}
                  onChange={(event) =>
                    change({ ...draft, startDate: event.target.value })
                  }
                />
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <Label id={`${id}-through-label`} htmlFor={`${id}-through`}>
                Through (UTC)
              </Label>
              {inputMode === 'calendar' ? (
                <PeriodDatePicker
                  id={`${id}-through`}
                  value={draft.endDate}
                  invalid={invalid}
                  errorId={`${id}-error`}
                  onChange={(endDate) => change({ ...draft, endDate })}
                />
              ) : (
                <Input
                  id={`${id}-through`}
                  type="date"
                  value={draft.endDate}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${id}-error` : undefined}
                  onChange={(event) =>
                    change({ ...draft, endDate: event.target.value })
                  }
                />
              )}
            </div>
          </div>
          {invalid && (
            <Alert id={`${id}-error`} variant="destructive">
              <AlertTitle>Invalid reporting period</AlertTitle>
              <AlertDescription>
                Choose valid dates, keep the end date on or after the start
                date, and select no more than {maxDeliveryReportDays} calendar
                days.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {props.allowAllDates && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  props.onChange(null);
                  openChange(false);
                }}
              >
                Clear dates
              </Button>
            )}
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

function PeriodDatePicker({
  id,
  value,
  invalid,
  errorId,
  onChange,
}: {
  id: string;
  value: string;
  invalid: boolean;
  errorId: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          aria-labelledby={`${id}-label`}
          className="w-full justify-between font-normal"
        >
          {value ? formatReportDate(value) : 'Pick a date'}
          <CalendarDays aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0"
        aria-labelledby={`${id}-label`}
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          autoFocus
          onSelect={(date) => {
            onChange(date ? format(date, 'yyyy-MM-dd') : '');
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
