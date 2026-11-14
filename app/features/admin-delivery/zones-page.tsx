import { Fragment, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
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
  FilterBuilder,
  FilterLabels,
  type FilterField,
  type FilterRule,
} from '~/shared/components/filter-builder';
import { Alert } from '~/shared/components/ui/alert';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import { createAdminDeliveryApi } from './api';
import type { Zone, ZoneInput } from './contracts';
import { ZoneEditor } from './zone-editor';
import { ZoneDetails } from './zone-details';

function ZoneContent() {
  const { session, user } = useIdentity();
  const api = useMemo(() => createAdminDeliveryApi(session), [session]);
  const queries = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editor, setEditor] = useState<Zone | null | undefined>(undefined);
  const [notice, setNotice] = useState('');
  const addButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const filters: {
    search?: string;
    city?: string;
    notCity?: string;
    status?: string;
  } = { search };
  for (const rule of rules) {
    if (rule.key === 'status')
      filters.status =
        rule.operator === 'is'
          ? rule.value
          : rule.value === 'active'
            ? 'inactive'
            : 'active';
    if (rule.key === 'city')
      filters[rule.operator === 'is' ? 'city' : 'notCity'] = rule.value;
  }
  const zones = useQuery({
    queryKey: ['admin-zones', user!.id, page, filters],
    queryFn: ({ signal }) => api.listZones(page, 20, filters, signal),
    retry: false,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === user!.id ? previous : undefined,
  });
  const cities = zones.data?.cities ?? [];
  const fields: FilterField[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    {
      key: 'city',
      label: 'City / region',
      options: cities.map((city) => ({ value: city, label: city })),
    },
  ];
  function closeEditor(saved = false) {
    setEditor(undefined);
    requestAnimationFrame(() => {
      const target =
        !saved && opener.current?.isConnected
          ? opener.current
          : addButton.current;
      target?.focus();
    });
  }
  const save = useMutation({
    retry: false,
    mutationFn: (input: ZoneInput) =>
      editor ? api.updateZone(editor.id, input) : api.createZone(input),
    onSuccess: () => {
      setNotice(
        editor
          ? 'Delivery zone updated successfully.'
          : 'Delivery zone created successfully.',
      );
      setPage(1);
      setExpanded(null);
      closeEditor(true);
      for (const key of [
        'admin-zones',
        'admin-zones-all',
        'admin-zone-summary',
        'admin-pricing',
      ])
        void queries.invalidateQueries({ queryKey: [key, user!.id] });
    },
  });
  function open(zone: Zone | null, button: HTMLButtonElement) {
    opener.current = button;
    save.reset();
    setNotice('');
    setEditor(zone);
  }
  function changeFilters(next: FilterRule[]) {
    setRules(next);
    setPage(1);
    setExpanded(null);
  }
  function clearAll() {
    changeFilters([]);
    setSearch('');
    setSearchDraft('');
  }
  function toggle(id: string) {
    setExpanded((current) => (current === id ? null : id));
  }
  return (
    <AdminWorkspace
      title="Delivery zones"
      actions={
        <>
          <FilterBuilder
            fields={fields}
            rules={rules}
            onChange={changeFilters}
            onClearAll={clearAll}
          />
          <Button
            variant="outline"
            disabled={zones.isFetching}
            onClick={() => void zones.refetch()}
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </Button>
          <Button
            ref={addButton}
            onClick={(event) => open(null, event.currentTarget)}
          >
            <Plus aria-hidden="true" />
            Add zone
          </Button>
        </>
      }
    >
      {notice && <Alert role="status">{notice}</Alert>}
      <Card className="min-w-0">
        <CardHeader className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <CardTitle className="text-base">Service coverage</CardTitle>
          <form
            className="flex w-full items-center gap-2 sm:max-w-md"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchDraft.trim());
              setPage(1);
              setExpanded(null);
            }}
          >
            <Label htmlFor="zone-search" className="sr-only">
              Search zones
            </Label>
            <Input
              id="zone-search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              maxLength={200}
              placeholder="Search name, city or postal code"
            />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              aria-label="Search zones"
            >
              <Search aria-hidden="true" />
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          {(rules.length > 0 || search) && (
            <div className="flex flex-wrap items-center gap-2">
              <FilterLabels
                fields={fields}
                rules={rules}
                onChange={changeFilters}
                hideClearAll
              />
              {search && (
                <Badge
                  variant="secondary"
                  className="max-w-full gap-1 break-words whitespace-normal py-1 pl-3 pr-1"
                >
                  Search: {search}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    aria-label="Clear zone search"
                    onClick={() => {
                      setSearch('');
                      setSearchDraft('');
                      setPage(1);
                    }}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
              >
                Clear all filters
              </Button>
            </div>
          )}
          {zones.isPending || zones.isPlaceholderData ? (
            <WorkspaceLoading label="Loading delivery zones..." />
          ) : zones.isError ? (
            <WorkspaceNotice
              destructive
              title="Unable to load delivery zones"
              description="Your saved configuration is unchanged. Check your connection and try again."
              pending={zones.isFetching}
              retry={() => void zones.refetch()}
            />
          ) : (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                {zones.data.totalCount} matching zones
              </p>
              {!zones.data.items.length ? (
                <WorkspaceNotice
                  title={
                    rules.length || search
                      ? 'No zones match these filters.'
                      : 'No delivery zones configured yet.'
                  }
                  description={
                    rules.length || search
                      ? 'Clear or change the filters to broaden your search.'
                      : 'Add a delivery zone to define the areas your team serves.'
                  }
                />
              ) : (
                <div className="min-w-0 overflow-x-auto">
                  <Table className="min-w-[42rem]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Zone name</TableHead>
                        <TableHead>City / region</TableHead>
                        <TableHead>Postal coverage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {zones.data.items.map((zone) => (
                        <Fragment key={zone.id}>
                          <TableRow>
                            <TableCell>
                              <Button
                                variant="ghost"
                                className="h-auto max-w-64 justify-start gap-2 whitespace-normal p-1 text-left font-medium"
                                aria-expanded={expanded === zone.id}
                                aria-controls={`zone-details-${zone.id}`}
                                aria-label={`${expanded === zone.id ? 'Hide' : 'Show'} details for ${zone.name}`}
                                onClick={() => toggle(zone.id)}
                              >
                                {expanded === zone.id ? (
                                  <ChevronDown
                                    className="size-4 shrink-0"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <ChevronRight
                                    className="size-4 shrink-0"
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="break-words">{zone.name}</span>
                              </Button>
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-2">
                                <MapPin
                                  className="size-3.5 shrink-0 text-muted-foreground"
                                  aria-hidden="true"
                                />
                                {zone.city || 'Not specified'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex max-w-xs flex-wrap items-center gap-1.5">
                                {zone.servicePostalCodes
                                  .slice(0, 3)
                                  .map((code) => (
                                    <Badge key={code} variant="secondary">
                                      {code}
                                    </Badge>
                                  ))}
                                {zone.servicePostalCodes.length > 3 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2"
                                    aria-label={`Show all postal codes for ${zone.name}`}
                                    onClick={() => setExpanded(zone.id)}
                                  >
                                    +{zone.servicePostalCodes.length - 3} more
                                  </Button>
                                )}
                                {!zone.servicePostalCodes.length && (
                                  <span className="text-sm text-muted-foreground">
                                    No codes assigned
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  zone.isActive ? 'secondary' : 'outline'
                                }
                              >
                                {zone.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Edit ${zone.name}`}
                                onClick={(event) =>
                                  open(zone, event.currentTarget)
                                }
                              >
                                <Pencil aria-hidden="true" />
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                          {expanded === zone.id && (
                            <TableRow id={`zone-details-${zone.id}`}>
                              <TableCell
                                colSpan={5}
                                className="p-0 whitespace-normal"
                              >
                                <ZoneDetails zone={zone} />
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <nav
                aria-label="Zone pagination"
                className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
              >
                <span className="text-sm text-muted-foreground">
                  Page {page} of{' '}
                  {Math.max(1, Math.ceil(zones.data.totalCount / 20))}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => {
                      setPage((current) => current - 1);
                      setExpanded(null);
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * 20 >= zones.data.totalCount}
                    onClick={() => {
                      setPage((current) => current + 1);
                      setExpanded(null);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </nav>
            </>
          )}
        </CardContent>
      </Card>
      {editor !== undefined && (
        <ZoneEditor
          key={editor?.id ?? 'new'}
          zone={editor}
          open
          pending={save.isPending}
          error={save.error}
          onClose={() => closeEditor()}
          onSave={(input) => save.mutate(input)}
        />
      )}
    </AdminWorkspace>
  );
}
export default function AdminZonesRoute() {
  return (
    <IdentityShell>
      <Protected admin>
        <ZoneContent />
      </Protected>
    </IdentityShell>
  );
}
