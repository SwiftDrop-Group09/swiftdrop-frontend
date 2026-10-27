import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { adminInputSchema, roles } from './contracts';
import type { AdminInput, Profile } from './contracts';
import { FieldError, IdentityShell, Protected, safeError } from './components';
import { useIdentity } from './session';

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
      <button disabled={page === 1 || pending} onClick={() => change(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} · {total} records
      </span>
      <button
        disabled={page * 20 >= total || pending}
        onClick={() => change(page + 1)}
      >
        Next
      </button>
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
    <section className="card">
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
          <input type="email" autoComplete="off" {...form.register('email')} />
          <FieldError message={form.formState.errors.email?.message} />
        </label>
        <label>
          Full name
          <input autoComplete="off" {...form.register('fullName')} />
          <FieldError message={form.formState.errors.fullName?.message} />
        </label>
        <label className="checkbox">
          <input type="checkbox" {...form.register('isActive')} />
          Account active
        </label>
        <label>
          Initial password
          <input
            type={reveal ? 'text' : 'password'}
            autoComplete="new-password"
            {...form.register('password')}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </label>
        <div>
          <button
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
          </button>
          <button type="button" onClick={() => setReveal((value) => !value)}>
            {reveal ? 'Hide password' : 'Show password'}
          </button>
        </div>
        {confirm && (
          <p role="status">
            Confirm creating this account. Make sure its initial password has
            been shared privately.
          </p>
        )}
        <button disabled={mutation.isPending}>
          {mutation.isPending
            ? 'Creating…'
            : confirm
              ? 'Confirm create account'
              : 'Review new account'}
        </button>
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
    <section className="card">
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
          <input type="email" {...form.register('email')} />
          <FieldError message={form.formState.errors.email?.message} />
        </label>
        <label>
          Full name
          <input {...form.register('fullName')} />
          <FieldError message={form.formState.errors.fullName?.message} />
        </label>
        <label className="checkbox">
          <input type="checkbox" {...form.register('isActive')} />
          Account active
        </label>
        <button disabled={mutation.isPending}>Review account change</button>
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
      <button
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
      </button>
      <button
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
      </button>
      {confirmation && (
        <div
          role="group"
          aria-labelledby="confirm-title"
          className="confirmation"
        >
          <h3 id="confirm-title">{confirmation.title}</h3>
          <button
            disabled={mutation.isPending}
            onClick={() => {
              void mutation.mutateAsync(confirmation.execute).catch(() => {});
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Confirm change'}
          </button>
          <button
            disabled={mutation.isPending}
            onClick={() => setConfirmation(null)}
          >
            Cancel
          </button>
        </div>
      )}
      {mutation.error && <p role="alert">{safeError(mutation.error)}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
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
      <section className="card wide">
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
              <table>
                <caption>User accounts</caption>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((profile) => (
                    <tr key={profile.id}>
                      <td>{profile.fullName}</td>
                      <td>{profile.email}</td>
                      <td>{profile.roles.join(', ') || 'None'}</td>
                      <td>{profile.isActive ? 'Active' : 'Inactive'}</td>
                      <td>
                        <button onClick={() => setSelected(profile)}>
                          Edit {profile.email}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      </section>
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
      <section className="card wide">
        <h2>Identity audit log</h2>
        <button onClick={() => setShowAudit((value) => !value)}>
          {showAudit ? 'Hide audit log' : 'View audit log'}
        </button>
        {showAudit &&
          (audit.isPending ? (
            <p role="status">Loading audit log…</p>
          ) : audit.error ? (
            <p role="alert">{safeError(audit.error)}</p>
          ) : (
            <>
              <div className="table-scroll">
                <table>
                  <caption>Identity audit records · UTC timestamps</caption>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Resource</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data.items.map((record) => (
                      <tr key={record.id}>
                        <td>{record.timestamp}</td>
                        <td>{record.action}</td>
                        <td className="identifier">
                          {record.actorId ?? 'Anonymous'}
                        </td>
                        <td className="identifier">
                          {record.resourceId ?? '—'}
                        </td>
                        <td>{record.resultCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
      </section>
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
