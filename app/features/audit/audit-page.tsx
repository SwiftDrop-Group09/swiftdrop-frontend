import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { IdentityShell, Protected } from '~/features/identity/components';
import { AdminWorkspace } from '~/features/identity/admin-workspace';
import { useIdentity } from '~/features/identity/session';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/components/ui/card';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Badge } from '~/shared/components/ui/badge';
import {
  NativeSelect,
  NativeSelectOption,
} from '~/shared/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/shared/components/ui/dialog';
import {
  readAudit,
  validateFilters,
  emptyFilters,
  services,
  type AuditFilters,
  type Cursors,
  type Activity,
} from './api';

const selects: {
  key: keyof AuditFilters;
  label: string;
  values: readonly string[];
}[] = [
  { key: 'service', label: 'Service', values: services },
  {
    key: 'role',
    label: 'Role',
    values: [
      'Customer',
      'Courier',
      'Merchant',
      'Dispatcher',
      'Admin',
      'System',
    ],
  },
  {
    key: 'actorType',
    label: 'Actor type',
    values: ['Human', 'Service', 'Anonymous', 'System'],
  },
  {
    key: 'outcome',
    label: 'Outcome',
    values: ['Success', 'Denied', 'Failed', 'InProgress'],
  },
  {
    key: 'method',
    label: 'Method',
    values: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'SYSTEM'],
  },
  {
    key: 'kind',
    label: 'Record type',
    values: ['Request', 'Security', 'Domain', 'Configuration', 'Background'],
  },
];
function AuditContent() {
  const { user, session } = useIdentity();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [snapshot, setSnapshot] = useState(() => new Date().toISOString());
  const [history, setHistory] = useState<Cursors[]>([{}]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [invalid, setInvalid] = useState('');
  const query = useQuery({
    queryKey: [
      'system-audit',
      user!.id,
      filters,
      snapshot,
      history[page],
      size,
    ],
    queryFn: ({ signal }) =>
      readAudit(session, filters, history[page] ?? {}, snapshot, size, signal),
    retry: false,
  });
  function update(key: keyof AuditFilters, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function resetPage() {
    setPage(0);
    setHistory([{}]);
    setSnapshot(new Date().toISOString());
  }
  function apply() {
    const validation = validateFilters(draft);
    if (validation) {
      setInvalid(validation);
      return;
    }
    if (draft.from && draft.to && new Date(draft.from) >= new Date(draft.to)) {
      setInvalid('The end of the time range must be after its start.');
      return;
    }
    setInvalid('');
    setFilters({
      ...draft,
      from: draft.from ? new Date(draft.from).toISOString() : '',
      to: draft.to ? new Date(draft.to).toISOString() : '',
    });
    resetPage();
  }
  return (
    <AdminWorkspace
      title="Audit log"
      description="Review actor activity, security events and delivery operations across services."
      actions={
        <Button
          variant="outline"
          disabled={query.isFetching}
          onClick={resetPage}
        >
          <RefreshCw aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Filter activity</CardTitle>
          <CardDescription>
            Time filters use your local timezone. The end time is exclusive.
            Historical records may not contain roles or IP addresses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              apply();
            }}
          >
            {selects.map(({ key, label, values }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`audit-${key}`}>{label}</Label>
                <NativeSelect
                  id={`audit-${key}`}
                  value={draft[key]}
                  onChange={(event) => update(key, event.target.value)}
                >
                  <NativeSelectOption value="">All</NativeSelectOption>
                  {values.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {value === 'InProgress'
                        ? 'No completion recorded'
                        : value}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ))}
            {(['from', 'to'] as const).map((key) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`audit-${key}`}>
                  {key === 'from' ? 'From' : 'Before'} (local time)
                </Label>
                <Input
                  id={`audit-${key}`}
                  type="datetime-local"
                  value={draft[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
              </div>
            ))}
            {(
              [
                { key: 'actorId', label: 'Actor ID' },
                { key: 'ip', label: 'IP address' },
                { key: 'action', label: 'Action contains' },
                { key: 'resourceId', label: 'Resource ID' },
                { key: 'correlationId', label: 'Correlation ID' },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`audit-${key}`}>{label}</Label>
                <Input
                  id={`audit-${key}`}
                  value={draft[key]}
                  maxLength={160}
                  onChange={(event) => update(key, event.target.value)}
                  autoComplete="off"
                />
              </div>
            ))}
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-4">
              <Button type="submit" disabled={query.isFetching}>
                <Search aria-hidden="true" />
                Apply filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(emptyFilters);
                  setFilters(emptyFilters);
                  setInvalid('');
                  resetPage();
                }}
              >
                Clear filters
              </Button>
            </div>
          </form>
          {invalid && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {invalid}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Activity records</CardTitle>
          <CardDescription>
            Times below are UTC. A record without completion may still be
            running or may have been interrupted. IP source identifies
            connection metadata versus an explicitly trusted proxy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {query.isPending ? (
            <WorkspaceLoading label="Loading audit records…" />
          ) : query.isError ? (
            <WorkspaceNotice
              destructive
              title="Unable to load audit log"
              description={query.error.message}
              retry={() => {
                void query.refetch();
              }}
              pending={query.isFetching}
            />
          ) : (
            <>
              {query.data.disabledSources.length > 0 && (
                <WorkspaceNotice
                  destructive
                  title="Activity recording is disabled"
                  description={`New activity is not being captured by ${query.data.disabledSources.join(', ')}. Historical records remain available.`}
                />
              )}
              <p role="status" className="text-sm text-muted-foreground">
                {query.data.totalCount} matching records · Page {page + 1}
              </p>
              {query.data.items.length === 0 ? (
                <WorkspaceNotice
                  title="No matching activity"
                  description="Try a wider time range or clear the filters."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time (UTC)</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Service / action</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>IP address</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.items.map((item) => (
                      <TableRow key={`${item.service}:${item.id}`}>
                        <TableCell className="whitespace-nowrap align-top text-xs">
                          {item.timestamp.replace('T', ' ').replace('Z', '')}
                        </TableCell>
                        <TableCell className="align-top">
                          <span className="block max-w-56 break-all font-mono text-xs">
                            {item.actorId ?? item.actorType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.roles.length
                              ? item.roles.join(', ')
                              : item.actorType}
                          </span>
                        </TableCell>
                        <TableCell className="align-top">
                          <span className="block text-xs text-muted-foreground">
                            {item.service} · {item.kind}
                          </span>
                          <span className="block max-w-72 break-words text-sm">
                            {item.action}
                          </span>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            variant={
                              item.outcome === 'Failed' ||
                              item.outcome === 'Denied'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {item.outcome === 'InProgress'
                              ? 'No completion'
                              : item.outcome}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <span className="block whitespace-nowrap font-mono text-xs">
                            {item.ipAddress ??
                              (item.actorType === 'System'
                                ? 'Not applicable'
                                : 'Not recorded')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.ipSource}
                          </span>
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`View ${item.action} details`}
                            onClick={() => setSelected(item)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <nav
                aria-label="Audit pagination"
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <Label htmlFor="audit-size">Rows</Label>
                  <NativeSelect
                    id="audit-size"
                    value={size}
                    onChange={(event) => {
                      setSize(Number(event.target.value));
                      resetPage();
                    }}
                  >
                    {[20, 50, 100].map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {value}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0 || query.isFetching}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!query.data.hasMore || query.isFetching}
                    onClick={() => {
                      setHistory((current) => [
                        ...current.slice(0, page + 1),
                        query.data.next,
                      ]);
                      setPage((current) => current + 1);
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
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity details</DialogTitle>
            <DialogDescription>
              Server-recorded metadata. Request and response bodies are not
              stored.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {Object.entries(selected).map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="font-medium">{key}</dt>
                  <dd className="mt-1 break-all text-muted-foreground">
                    {value === null
                      ? 'Not recorded'
                      : Array.isArray(value)
                        ? value.join(', ') || 'Not recorded'
                        : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </AdminWorkspace>
  );
}

export function AuditPage() {
  return (
    <IdentityShell>
      <Protected admin>
        <AuditContent />
      </Protected>
    </IdentityShell>
  );
}
