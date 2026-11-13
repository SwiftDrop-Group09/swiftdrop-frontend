import { Link, Navigate, useLocation } from 'react-router';
import { Checkbox } from '~/shared/components/ui/checkbox';
import { Badge } from '~/shared/components/ui/badge';
import { Label } from '~/shared/components/ui/label';
import { Alert } from '~/shared/components/ui/alert';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { adminInputSchema, roles } from './contracts';
import type { AdminInput, Profile } from './contracts';
import { FieldError, IdentityShell, Protected, safeError } from './components';
import { useIdentity } from './session';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Card } from '~/shared/components/ui/card';
import { AdminWorkspace } from './admin-workspace';
import {
  WorkspaceLoading,
  WorkspaceNotice,
} from '~/shared/components/workspace-state';
import { FieldSet, FieldLegend } from '~/shared/components/ui/field';
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
      <Button
        variant="outline"
        size="sm"
        disabled={page === 1 || pending}
        onClick={() => change(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} · {total} records
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page * 20 >= total || pending}
        onClick={() => change(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
const createSchema = adminInputSchema.extend({
  password: z.string().min(12, 'Use at least 12 characters.').max(128),
});
type CreateInput = z.infer<typeof createSchema>;
function CreateUser({ created }: { created: (user: Profile) => void }) {
  const { session } = useIdentity();
  const [confirm, setConfirm] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<CreateInput>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: '', fullName: '', isActive: true, password: '' },
  });
  const mutation = useMutation({
    mutationFn: () => {
      const input = form.getValues();
      return session.authorized((token) =>
        session.api.createUser(token, input),
      );
    },
    onSuccess: (profile) => {
      created(profile);
      form.reset();
      setNotice(
        'Account created. Assign any additional roles from its account details.',
      );
    },
  });
  const submit = form.handleSubmit(async () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setNotice(null);
    try {
      await mutation.mutateAsync();
    } catch {
      /* Safe error below; mutations are never retried automatically. */
    } finally {
      form.resetField('password');
      setReveal(false);
      setConfirm(false);
    }
  });
  return (
    <section>
      <Card className="w-full space-y-5 p-4 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          Create user account
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Generate a unique password and share it privately. The password is
          cleared after submission and cannot be retrieved later.
        </p>
        <form
          className="grid gap-5 sm:grid-cols-2"
          onSubmit={(event) => {
            void submit(event);
          }}
          onChange={() => setConfirm(false)}
          noValidate
        >
          <Label className="grid gap-2">
            Email
            <Input
              type="email"
              autoComplete="off"
              {...form.register('email')}
            />
            <FieldError message={form.formState.errors.email?.message} />
          </Label>
          <Label className="grid gap-2">
            Full name
            <Input autoComplete="off" {...form.register('fullName')} />
            <FieldError message={form.formState.errors.fullName?.message} />
          </Label>
          <Label className="flex items-center gap-2">
            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <Checkbox
                  ref={field.ref}
                  name={field.name}
                  checked={field.value}
                  onBlur={field.onBlur}
                  onCheckedChange={(checked) => {
                    field.onChange(checked === true);
                    setConfirm(false);
                  }}
                />
              )}
            />
            Account active
          </Label>
          <Label className="grid gap-2">
            Initial password
            <Input
              type={reveal ? 'text' : 'password'}
              autoComplete="new-password"
              {...form.register('password')}
            />
            <FieldError message={form.formState.errors.password?.message} />
          </Label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                const bytes = crypto.getRandomValues(new Uint8Array(24));
                form.setValue(
                  'password',
                  btoa(String.fromCharCode(...bytes))
                    .replaceAll('+', '-')
                    .replaceAll('/', '_'),
                  { shouldValidate: true },
                );
                setConfirm(false);
              }}
            >
              Generate password
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReveal((value) => !value)}
            >
              {reveal ? 'Hide password' : 'Show password'}
            </Button>
          </div>
          {confirm && (
            <Alert role="status" className="sm:col-span-2">
              Confirm creating this account. Make sure its initial password has
              been shared privately.
            </Alert>
          )}
          <Button
            className="sm:col-span-2 sm:justify-self-start"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? 'Creating…'
              : confirm
                ? 'Confirm create account'
                : 'Review new account'}
          </Button>
        </form>
        {mutation.error && (
          <>
            <Alert variant="destructive">{safeError(mutation.error)}</Alert>
            <p>
              Reload the user list before repeating a request whose outcome is
              uncertain.
            </p>
          </>
        )}
        {notice && <Alert role="status">{notice}</Alert>}
      </Card>
    </section>
  );
}
function UserEditor({
  profile,
  updated,
}: {
  profile: Profile;
  updated: (user: Profile) => void;
}) {
  const { session, user } = useIdentity();
  const [selectedRoles, setSelectedRoles] = useState<string[]>(profile.roles);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    execute: () => Promise<unknown>;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<AdminInput>({
    resolver: zodResolver(adminInputSchema),
    defaultValues: {
      email: profile.email,
      fullName: profile.fullName,
      isActive: profile.isActive,
    },
  });
  const mutation = useMutation({
    mutationFn: async (execute: () => Promise<unknown>) => execute(),
    onSuccess: () => {
      setNotice('Account change saved.');
      setConfirmation(null);
    },
  });
  async function receive(result: Profile, refreshSelf = false) {
    form.reset({
      email: result.email,
      fullName: result.fullName,
      isActive: result.isActive,
    });
    setSelectedRoles(result.roles);
    updated(result);
    if (result.id === user!.id) {
      session.updateUser(result);
      if (refreshSelf) {
        try {
          await session.refresh();
        } catch {
          /* The server accepted the change; an inactive account is now signed out. */
        }
      }
    }
  }
  const submit = form.handleSubmit((values) => {
    setNotice(null);
    setConfirmation({
      title: `Save account details for ${profile.email}?`,
      execute: async () =>
        receive(
          await session.authorized((token) =>
            session.api.updateUser(token, profile.id, values),
          ),
          values.isActive !== profile.isActive,
        ),
    });
  });
  return (
    <section>
      <Card className="w-full space-y-5 p-4 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          Edit {profile.fullName}
        </h2>
        <p className="break-all text-xs text-muted-foreground">
          Account ID: {profile.id}
        </p>
        <form
          className="grid gap-5 sm:grid-cols-2"
          onSubmit={(event) => {
            void submit(event);
          }}
          onChange={() => setConfirmation(null)}
          noValidate
        >
          <Label className="grid gap-2">
            Email
            <Input type="email" {...form.register('email')} />
            <FieldError message={form.formState.errors.email?.message} />
          </Label>
          <Label className="grid gap-2">
            Full name
            <Input {...form.register('fullName')} />
            <FieldError message={form.formState.errors.fullName?.message} />
          </Label>
          <Label className="flex items-center gap-2">
            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <Checkbox
                  ref={field.ref}
                  name={field.name}
                  checked={field.value}
                  onBlur={field.onBlur}
                  onCheckedChange={(checked) => {
                    field.onChange(checked === true);
                    setConfirmation(null);
                  }}
                />
              )}
            />
            Account active
          </Label>
          <Button className="sm:justify-self-end" disabled={mutation.isPending}>
            Review account change
          </Button>
        </form>
        <FieldSet
          className="grid gap-3 rounded-lg border p-4"
          disabled={mutation.isPending}
        >
          <FieldLegend className="px-1 text-sm font-medium">
            Assigned roles
          </FieldLegend>
          {roles.map((role) => (
            <Label key={role} className="flex items-center gap-2">
              <Checkbox
                checked={selectedRoles.includes(role)}
                onCheckedChange={(checked) => {
                  setConfirmation(null);
                  setSelectedRoles((current) =>
                    checked === true
                      ? [...current, role]
                      : current.filter((value) => value !== role),
                  );
                }}
              />
              {role}
            </Label>
          ))}
        </FieldSet>
        <Button
          disabled={mutation.isPending}
          onClick={() => {
            setNotice(null);
            setConfirmation({
              title: `Replace roles for ${profile.email} with ${selectedRoles.join(', ') || 'no roles'}?`,
              execute: async () =>
                receive(
                  await session.authorized((token) =>
                    session.api.setRoles(token, profile.id, selectedRoles),
                  ),
                  true,
                ),
            });
          }}
        >
          Review role changes
        </Button>
        <Button
          variant="destructive"
          disabled={mutation.isPending || !profile.isActive}
          onClick={() => {
            setNotice(null);
            setConfirmation({
              title: `Deactivate ${profile.email}? New sign-ins and refreshes will be denied. Existing access tokens may remain valid for 900 seconds plus 30 seconds of clock skew.`,
              execute: async () => {
                await session.authorized((token) =>
                  session.api.deactivate(token, profile.id),
                );
                await receive({ ...profile, isActive: false }, true);
              },
            });
          }}
        >
          Deactivate account
        </Button>
        {confirmation && (
          <Card
            role="group"
            aria-labelledby="confirm-title"
            className="space-y-4 rounded-lg border bg-muted/50 p-4"
          >
            <h3 className="font-semibold" id="confirm-title">
              {confirmation.title}
            </h3>
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                void mutation.mutateAsync(confirmation.execute).catch(() => {});
              }}
            >
              {mutation.isPending ? 'Saving…' : 'Confirm change'}
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </Button>
          </Card>
        )}
        {mutation.error && (
          <Alert variant="destructive">{safeError(mutation.error)}</Alert>
        )}
        {notice && <Alert role="status">{notice}</Alert>}
      </Card>
    </section>
  );
}
function AdminContent() {
  const { session } = useIdentity();
  const queries = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Profile | null>(null);
  const users = useQuery({
    queryKey: ['identity', 'users', page],
    queryFn: () =>
      session.authorized((token) => session.api.users(token, page)),
  });
  return (
    <>
      <section>
        <Card className="min-w-0 space-y-5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">
            User accounts
          </h2>
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
              <div className="min-w-0">
                <Table>
                  <caption className="sr-only">User accounts</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.data.items.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell>{profile.fullName}</TableCell>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>
                          {profile.roles.join(', ') || 'None'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={profile.isActive ? 'default' : 'secondary'}
                          >
                            {profile.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelected(profile)}
                          >
                            Edit {profile.email}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {users.data.items.length === 0 && (
                <p>No user accounts on this page.</p>
              )}
              <Pagination
                page={page}
                total={users.data.totalCount}
                pending={users.isFetching}
                change={setPage}
              />
            </>
          )}
        </Card>
      </section>
      <CreateUser
        created={(profile) => {
          setSelected(profile);
          void queries.invalidateQueries({ queryKey: ['identity', 'users'] });
          void queries.invalidateQueries({ queryKey: ['system-audit'] });
        }}
      />
      {selected && (
        <UserEditor
          key={selected.id}
          profile={selected}
          updated={(profile) => {
            setSelected(profile);
            void queries.invalidateQueries({ queryKey: ['identity', 'users'] });
            void queries.invalidateQueries({ queryKey: ['system-audit'] });
          }}
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
          title="User administration"
          description="Manage account status and roles. Every change is checked and audited by the server."
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
