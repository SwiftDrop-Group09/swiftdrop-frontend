import { useId, useState, type ReactNode } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from './ui/popover';
export type FilterRule = {
  key: string;
  operator: 'is' | 'isNot';
  value: string;
  valueLabel?: string;
};
export type FilterField = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};
export function FilterBuilder({
  fields,
  rules,
  onChange,
  children,
  onClearAll,
}: {
  fields: FilterField[];
  rules: FilterRule[];
  onChange: (rules: FilterRule[]) => void;
  children?: ReactNode;
  onClearAll?: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(fields[0]?.key ?? '');
  const [operator, setOperator] = useState<FilterRule['operator']>('is');
  const [value, setValue] = useState('');
  const field = fields.find((field) => field.key === key);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Filter aria-hidden="true" />
          Filters
          {rules.length > 0 && (
            <Badge variant="secondary">{rules.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] max-h-[min(42rem,var(--radix-popover-content-available-height))] space-y-4 overflow-y-auto"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      >
        <PopoverHeader>
          <PopoverTitle id={`${id}-title`}>Filter records</PopoverTitle>
          <PopoverDescription id={`${id}-description`}>
            Choose a field, comparison and value. Filters are combined with AND.
            Adding the same field replaces its previous filter.
          </PopoverDescription>
        </PopoverHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !value ||
              !field?.options.some((option) => option.value === value)
            )
              return;
            onChange([
              ...rules.filter((rule) => rule.key !== key),
              {
                key,
                operator,
                value,
                valueLabel: field.options.find(
                  (option) => option.value === value,
                )?.label,
              },
            ]);
            setOpen(false);
            setValue('');
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${id}-key`}>Key</Label>
            <NativeSelect
              id={`${id}-key`}
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setValue('');
              }}
            >
              {fields.map((field) => (
                <NativeSelectOption key={field.key} value={field.key}>
                  {field.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-operator`}>Comparison</Label>
            <NativeSelect
              id={`${id}-operator`}
              value={operator}
              onChange={(event) =>
                setOperator(event.target.value as FilterRule['operator'])
              }
            >
              <NativeSelectOption value="is">Is</NativeSelectOption>
              <NativeSelectOption value="isNot">Is not</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-value`}>Value</Label>
            <NativeSelect
              id={`${id}-value`}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            >
              <NativeSelectOption value="">
                {field?.options.length
                  ? 'Choose a value'
                  : 'No values on this page'}
              </NativeSelectOption>
              {field?.options.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={!value}>
            Add filter
          </Button>
        </form>
        {children}
        <FilterLabels
          fields={fields}
          rules={rules}
          onChange={onChange}
          onClearAll={onClearAll}
        />
      </PopoverContent>
    </Popover>
  );
}
export function FilterLabels({
  fields,
  rules,
  onChange,
  onClearAll,
  hideClearAll = false,
}: {
  fields: FilterField[];
  rules: FilterRule[];
  onChange: (rules: FilterRule[]) => void;
  onClearAll?: () => void;
  hideClearAll?: boolean;
}) {
  if (!rules.length) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Active filters"
    >
      {rules.map((rule) => {
        const field = fields.find((field) => field.key === rule.key);
        const text = `${field?.label ?? rule.key} ${rule.operator === 'is' ? 'is' : 'is not'} ${rule.valueLabel ?? field?.options.find((option) => option.value === rule.value)?.label ?? rule.value}`;
        return (
          <Badge
            key={rule.key}
            variant="secondary"
            className="max-w-full gap-1 whitespace-normal break-words py-1 pl-3 pr-1"
          >
            {text}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              aria-label={`Remove filter: ${text}`}
              onClick={() =>
                onChange(rules.filter((item) => item.key !== rule.key))
              }
            >
              <X aria-hidden="true" />
            </Button>
          </Badge>
        );
      })}
      {!hideClearAll && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => (onClearAll ? onClearAll() : onChange([]))}
        >
          Clear all filters
        </Button>
      )}
    </div>
  );
}
