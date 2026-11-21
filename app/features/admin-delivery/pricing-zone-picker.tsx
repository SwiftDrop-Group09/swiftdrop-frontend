import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useIdentity } from '~/features/identity/session';
import { Button } from '~/shared/components/ui/button';
import { Badge } from '~/shared/components/ui/badge';
import { Input } from '~/shared/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/shared/components/ui/popover';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { createAdminDeliveryApi } from './api';
import type { Zone } from './contracts';

/** Server-paged choices avoid silently truncating the zone catalog at 100 rows. */
export function PricingZonePicker({
  value,
  valueLabel,
  label,
  allowAll = false,
  disabled = false,
  onChange,
}: {
  value: string;
  valueLabel?: string;
  label: string;
  allowAll?: boolean;
  disabled?: boolean;
  onChange: (zone: Zone | null) => void;
}) {
  const { session, user } = useIdentity();
  const api = useMemo(() => createAdminDeliveryApi(session), [session]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const zones = useQuery({
    queryKey: ['admin-zones-all', user!.id, 'pricing-picker', search, page],
    queryFn: ({ signal }) => api.listZones(page, 20, { search }, signal),
    enabled: open,
    retry: false,
  });
  const selectedName =
    valueLabel || zones.data?.items.find((zone) => zone.id === value)?.name;
  function select(zone: Zone | null) {
    onChange(zone);
    setOpen(false);
  }
  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={label}
          className="w-full min-w-0 justify-between gap-3 font-normal"
        >
          <span className="truncate">
            {value
              ? selectedName || 'Selected delivery zone'
              : allowAll
                ? 'All delivery zones'
                : 'Select delivery zone'}
          </span>
          <ChevronsUpDown
            className="shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(24rem,calc(100vw-2rem))] max-h-[min(36rem,var(--radix-popover-content-available-height))] space-y-3 overflow-y-auto"
        aria-label="Choose delivery zone"
      >
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <Input
            aria-label="Search delivery zones"
            placeholder="Name, city or postal code"
            maxLength={200}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            size="icon"
            aria-label="Search delivery zones"
          >
            <Search aria-hidden="true" />
          </Button>
        </form>
        {allowAll && (
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => select(null)}
          >
            All delivery zones
            {!value && <Check aria-hidden="true" className="ml-auto" />}
          </Button>
        )}
        {zones.isPending ? (
          <WorkspaceLoading label="Loading delivery zones..." />
        ) : zones.isError ? (
          <WorkspaceNotice
            destructive
            title="Unable to load delivery zones"
            description="Your selection is unchanged."
            retry={() => void zones.refetch()}
            pending={zones.isFetching}
          />
        ) : (
          <>
            <div className="space-y-1" aria-label="Delivery zone choices">
              {zones.data.items.map((zone) => (
                <Button
                  key={zone.id}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start gap-3 py-3 text-left whitespace-normal"
                  onClick={() => select(zone)}
                >
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block break-words font-medium">
                      {zone.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {zone.city || 'No city configured'}
                    </span>
                  </span>
                  {!zone.isActive && <Badge variant="outline">Inactive</Badge>}
                  {zone.id === value && (
                    <Check aria-hidden="true" className="shrink-0" />
                  )}
                </Button>
              ))}
              {!zones.data.items.length && (
                <p className="py-4 text-sm text-muted-foreground">
                  {search
                    ? 'No zones match your search.'
                    : 'No delivery zones configured yet.'}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <span className="text-xs text-muted-foreground">
                {zones.data.totalCount} zones
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page === 1 || zones.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Previous zones
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    page * 20 >= zones.data.totalCount || zones.isFetching
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Next zones
                </Button>
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
