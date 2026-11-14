import { useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import type { Profile } from './contracts';
import { IdentityShell, Protected, safeError } from './components';
import { useIdentity } from './session';
import { AdminWorkspace } from './admin-workspace';
import { AccountEditor, AccessEditor } from './user-dialogs';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Card } from '~/shared/components/ui/card';
import { Badge } from '~/shared/components/ui/badge';
import { Avatar, AvatarFallback } from '~/shared/components/ui/avatar';
import { Label } from '~/shared/components/ui/label';
import { Alert } from '~/shared/components/ui/alert';
import {
  NativeSelect,
  NativeSelectOption,
} from '~/shared/components/ui/native-select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '~/shared/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '~/shared/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/shared/components/ui/table';

export function Pagination({
  page,
  total,
  pending,
  change,
}: {
  page: number;
  total: number;
  pending: boolean;
  change: (page: number) => void;
}) {
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} · {total} {total === 1 ? 'record' : 'records'}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1 || pending}
          onClick={() => change(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page * 20 >= total || pending}
          onClick={() => change(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

type Editor =
  | { kind: 'account' | 'roles' | 'status'; profile: Profile }
  | { kind: 'create'; role: Profile['roles'][number] };
type RoleFilter = Profile['roles'][number] | 'all';
const roleViews: { value: RoleFilter; label: string }[] = [
  { value: 'Customer', label: 'Customers' },
  { value: 'Courier', label: 'Couriers' },
  { value: 'Merchant', label: 'Merchants' },
  { value: 'Dispatcher', label: 'Dispatchers' },
  { value: 'Admin', label: 'Admins' },
  { value: 'all', label: 'All users' },
];

function AdminContent() {
  const { session, user } = useIdentity();
  const queries = useQueryClient();
  const [role, setRole] = useState<RoleFilter>('Customer');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const lastAction = useRef<HTMLButtonElement | null>(null);
  const filters = {
    role: role === 'all' ? undefined : role,
    status: status || undefined,
    search: appliedSearch || undefined,
  };
  const users = useQuery({
    queryKey: ['identity', 'users', user?.id, filters, page],
    queryFn: () =>
      session.authorized((token) => session.api.users(token, page, filters)),
    retry: false,
  });
  const close = () => {
    setEditor(null);
    requestAnimationFrame(() =>
      (lastAction.current?.isConnected
        ? lastAction.current
        : addButton.current
      )?.focus(),
    );
  };
  const saved = (_profile: Profile, message: string) => {
    close();
    setNotice(message);
    void queries.invalidateQueries({ queryKey: ['identity', 'users'] });
    void queries.invalidateQueries({ queryKey: ['system-audit'] });
    void queries.invalidateQueries({ queryKey: ['courier-directory'] });
    void queries.invalidateQueries({ queryKey: ['audit-actor-names'] });
  };
  const clear = () => {
    setSearch('');
    setAppliedSearch('');
    setStatus('');
    setPage(1);
  };
  return (
    <>
      {notice && <Alert role="status">{notice}</Alert>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-3">
            <Users className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">People & access</h2>
            <p className="text-sm text-muted-foreground">
              Manage customers first, then your delivery team and business
              accounts.
            </p>
          </div>
        </div>
        <Button
          ref={addButton}
          onClick={() => {
            lastAction.current = null;
            setEditor({
              kind: 'create',
              role: role === 'all' ? 'Customer' : role,
            });
          }}
        >
          <Plus />
          {role === 'all' ? 'Add user' : `Add ${role.toLowerCase()}`}
        </Button>
      </div>
      <Tabs
        value={role}
        onValueChange={(value) => {
          setRole(value as RoleFilter);
          setPage(1);
        }}
      >
        <div className="min-w-0 overflow-x-auto pb-1">
          <TabsList aria-label="User roles">
            {roleViews.map((view) => (
              <TabsTrigger key={view.value} value={view.value}>
                {view.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <Card className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setAppliedSearch(search.trim());
                setPage(1);
              }}
            >
              <Label className="grid w-full max-w-md gap-2">
                Search users
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={search}
                    maxLength={200}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name or email"
                  />
                </div>
              </Label>
              <Button className="self-end" type="submit" variant="outline">
                Search
              </Button>
            </form>
            <div className="flex items-end gap-2">
              <Label className="grid w-44 gap-2">
                Account status
                <NativeSelect
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <NativeSelectOption value="">All statuses</NativeSelectOption>
                  <NativeSelectOption value="active">Active</NativeSelectOption>
                  <NativeSelectOption value="inactive">
                    Inactive
                  </NativeSelectOption>
                </NativeSelect>
              </Label>
              {(search || appliedSearch || status) && (
                <Button variant="ghost" onClick={clear}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>
          {roleViews.map((view) => (
            <TabsContent
              key={view.value}
              value={view.value}
              className="space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-medium">
                  {view.label}
                  {users.data && (
                    <Badge variant="secondary">{users.data.totalCount}</Badge>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Users with multiple roles appear in each relevant group.
                </p>
              </div>
              {users.isPending ? (
                <WorkspaceLoading label="Loading users…" />
              ) : users.error ? (
                <WorkspaceNotice
                  title="Unable to load users"
                  description={safeError(users.error)}
                  destructive
                  pending={users.isFetching}
                  retry={() => {
                    void users.refetch();
                  }}
                />
              ) : (
                <>
                  {users.data.items.length ? (
                    <Table>
                      <caption className="sr-only">
                        {view.label} accounts
                      </caption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.data.items.map((profile) => (
                          <TableRow key={profile.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="hidden size-9 sm:flex">
                                  <AvatarFallback>
                                    {profile.fullName
                                      .split(/\s+/)
                                      .slice(0, 2)
                                      .map((part) => part[0])
                                      .join('')
                                      .toUpperCase() || <UserRound />}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {profile.fullName}
                                    </span>
                                    {profile.id === user?.id && (
                                      <Badge variant="outline">You</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {profile.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex max-w-60 flex-wrap gap-1">
                                {profile.roles.length ? (
                                  profile.roles.map((assigned) => (
                                    <Badge key={assigned} variant="outline">
                                      {assigned === 'Admin' && (
                                        <ShieldCheck className="size-3" />
                                      )}
                                      {assigned}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    No roles
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  profile.isActive ? 'secondary' : 'outline'
                                }
                              >
                                {profile.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Actions for ${profile.email}`}
                                    onPointerDown={(event) => {
                                      lastAction.current = event.currentTarget;
                                    }}
                                    onKeyDown={(event) => {
                                      lastAction.current = event.currentTarget;
                                    }}
                                  >
                                    <MoreHorizontal />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setEditor({ kind: 'account', profile })
                                    }
                                  >
                                    Edit account
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setEditor({ kind: 'roles', profile })
                                    }
                                  >
                                    Manage role
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant={
                                      profile.isActive
                                        ? 'destructive'
                                        : 'default'
                                    }
                                    onSelect={() =>
                                      setEditor({ kind: 'status', profile })
                                    }
                                  >
                                    {profile.isActive
                                      ? 'Deactivate'
                                      : 'Reactivate'}{' '}
                                    account
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-12 text-center">
                      <Users className="mb-1 size-7 text-muted-foreground" />
                      <p className="font-medium">
                        No {view.label.toLowerCase()} found
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {appliedSearch || status
                          ? 'Try another search or clear your filters.'
                          : view.value === 'Customer'
                            ? 'Add a customer to get started.'
                            : 'Users will appear here when this role is assigned.'}
                      </p>
                      {(appliedSearch || status) && (
                        <Button variant="outline" size="sm" onClick={clear}>
                          Clear filters
                        </Button>
                      )}
                    </div>
                  )}
                  <Pagination
                    page={page}
                    total={users.data.totalCount}
                    pending={users.isFetching}
                    change={setPage}
                  />
                </>
              )}
            </TabsContent>
          ))}
        </Card>
      </Tabs>
      {editor?.kind === 'create' && (
        <AccountEditor saved={saved} close={close} initialRole={editor.role} />
      )}
      {editor?.kind === 'account' && (
        <AccountEditor
          key={editor.profile.id}
          profile={editor.profile}
          saved={saved}
          close={close}
        />
      )}
      {editor && (editor.kind === 'roles' || editor.kind === 'status') && (
        <AccessEditor
          key={`${editor.profile.id}:${editor.kind}`}
          profile={editor.profile}
          kind={editor.kind}
          saved={saved}
          close={close}
        />
      )}
    </>
  );
}

export function AdminPage() {
  const { hash } = useLocation();
  if (hash === '#identity-audit') return <Navigate to="/admin/audit" replace />;
  return (
    <IdentityShell>
      <Protected admin>
        <AdminWorkspace
          title="User management"
          description="Customer accounts, team roles and access in one place."
          actions={
            <Button asChild variant="outline">
              <Link to="/admin/audit">Audit log</Link>
            </Button>
          }
        >
          <AdminContent />
        </AdminWorkspace>
      </Protected>
    </IdentityShell>
  );
}
