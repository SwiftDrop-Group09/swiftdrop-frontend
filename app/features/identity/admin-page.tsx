import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
    <nav className="pagination" aria-label="Pagination">
      <Button disabled={page === 1 || pending} onClick={() => change(page - 1)}>
        Previous
      </Button>
      <span>
        Page {page} · {total} records
      </span>
      <Button
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
    <Card className="card">
      <h2>Create user account</h2>
      <p>
        Generate a unique password and share it privately. The password is
        cleared after submission and cannot be retrieved later.
      </p>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        onChange={() => setConfirm(false)}
        noValidate
      >
        <label>
          Email
          <Input type="email" autoComplete="off" {...form.register('email')} />
          <FieldError message={form.formState.errors.email?.message} />
        </label>
        <label>
          Full name
          <Input autoComplete="off" {...form.register('fullName')} />
          <FieldError message={form.formState.errors.fullName?.message} />
        </label>
        <label className="checkbox">
          <input type="checkbox" {...form.register('isActive')} />
          Account active
        </label>
        <label>
          Initial password
          <Input
            type={reveal ? 'text' : 'password'}
            autoComplete="new-password"
            {...form.register('password')}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </label>
        <div>
          <Button
            type="button"
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
          <Button type="button" onClick={() => setReveal((value) => !value)}>
            {reveal ? 'Hide password' : 'Show password'}
          </Button>
        </div>
        {confirm && (
          <p role="status">
            Confirm creating this account. Make sure its initial password has
            been shared privately.
          </p>
        )}
        <Button disabled={mutation.isPending}>
          {mutation.isPending
            ? 'Creating…'
            : confirm
              ? 'Confirm create account'
              : 'Review new account'}
        </Button>
      </form>
      {mutation.error && (
        <>
          <p role="alert">{safeError(mutation.error)}</p>
          <p>
            Reload the user list before repeating a request whose outcome is
            uncertain.
          </p>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </Card>
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
    <Card className="card">
      <h2>Edit {profile.fullName}</h2>
      <p className="identifier">Account ID: {profile.id}</p>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        onChange={() => setConfirmation(null)}
        noValidate
      >
        <label>
          Email
          <Input type="email" {...form.register('email')} />
          <FieldError message={form.formState.errors.email?.message} />
        </label>
        <label>
          Full name
          <Input {...form.register('fullName')} />
          <FieldError message={form.formState.errors.fullName?.message} />
        </label>
        <label className="checkbox">
          <input type="checkbox" {...form.register('isActive')} />
          Account active
        </label>
        <Button disabled={mutation.isPending}>Review account change</Button>
      </form>
      <fieldset disabled={mutation.isPending}>
        <legend>Assigned roles</legend>
        {roles.map((role) => (
          <label key={role} className="checkbox">
            <input
              type="checkbox"
              checked={selectedRoles.includes(role)}
              onChange={(event) => {
                setConfirmation(null);
                setSelectedRoles((current) =>
                  event.target.checked
                    ? [...current, role]
                    : current.filter((value) => value !== role),
                );
              }}
            />
            {role}
          </label>
        ))}
      </fieldset>
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
        className="danger"
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
        <div
          role="group"
          aria-labelledby="confirm-title"
          className="confirmation"
        >
          <h3 id="confirm-title">{confirmation.title}</h3>
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
        </div>
      )}
      {mutation.error && <p role="alert">{safeError(mutation.error)}</p>}
      {notice && <p role="status">{notice}</p>}
    </Card>
  );
}
function AdminContent() {
  const { session } = useIdentity();
  const queries = useQueryClient();
  const [page, setPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const users = useQuery({
    queryKey: ['identity', 'users', page],
    queryFn: () =>
      session.authorized((token) => session.api.users(token, page)),
  });
  const audit = useQuery({
    queryKey: ['identity', 'audit', auditPage],
    queryFn: () =>
      session.authorized((token) => session.api.audit(token, auditPage)),
    enabled: showAudit,
  });
  return (
    <>
      <Card className="card wide">
        <h1>User administration</h1>
        <p>
          Manage account status and roles. Every change is checked and audited
          by the server.
        </p>
        {users.isPending ? (
          <p role="status">Loading users…</p>
        ) : users.error ? (
          <p role="alert">{safeError(users.error)}</p>
        ) : (
          <>
            <div className="table-scroll">
              <Table>
                <caption>User accounts</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
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
                        {profile.isActive ? 'Active' : 'Inactive'}
                      </TableCell>
                      <TableCell>
                        <Button onClick={() => setSelected(profile)}>
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
      <CreateUser
        created={(profile) => {
          setSelected(profile);
          void queries.invalidateQueries({ queryKey: ['identity', 'users'] });
          void queries.invalidateQueries({ queryKey: ['identity', 'audit'] });
        }}
      />
      {selected && (
        <UserEditor
          key={selected.id}
          profile={selected}
          updated={(profile) => {
            setSelected(profile);
            void queries.invalidateQueries({ queryKey: ['identity', 'users'] });
            void queries.invalidateQueries({ queryKey: ['identity', 'audit'] });
          }}
        />
      )}
      <Card className="card wide">
        <h2>Identity audit log</h2>
        <Button onClick={() => setShowAudit((value) => !value)}>
          {showAudit ? 'Hide audit log' : 'View audit log'}
        </Button>
        {showAudit &&
          (audit.isPending ? (
            <p role="status">Loading audit log…</p>
          ) : audit.error ? (
            <p role="alert">{safeError(audit.error)}</p>
          ) : (
            <>
              <div className="table-scroll">
                <Table>
                  <caption>Identity audit records · UTC timestamps</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.data.items.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.timestamp}</TableCell>
                        <TableCell>{record.action}</TableCell>
                        <TableCell className="identifier">
                          {record.actorId ?? 'Anonymous'}
                        </TableCell>
                        <TableCell className="identifier">
                          {record.resourceId ?? '—'}
                        </TableCell>
                        <TableCell>{record.resultCode}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {audit.data.items.length === 0 && (
                <p>No audit records on this page.</p>
              )}
              <Pagination
                page={auditPage}
                total={audit.data.totalCount}
                pending={audit.isFetching}
                change={setAuditPage}
              />
            </>
          ))}
      </Card>
    </>
  );
}
export function AdminPage() {
  return (
    <IdentityShell>
      <Protected admin>
        <AdminContent />
      </Protected>
    </IdentityShell>
  );
}
