import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { FieldError, IdentityShell, Protected, safeError } from './components';
import { profileInputSchema } from './contracts';
import type { Profile, ProfileInput } from './contracts';
import { GoogleButton } from './google-button';
import { useIdentity } from './session';

function ProfileForm({ user }: { user: Profile }) {
  const { session } = useIdentity();
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: {
      fullName: user.fullName,
      phoneNumber: user.phoneNumber ?? '',
      address: user.address ?? '',
    },
  });
  const mutation = useMutation({
    mutationFn: (input: ProfileInput) =>
      session.authorized((token) => session.api.updateProfile(token, input)),
    onSuccess: (value) => {
      session.updateUser(value);
      setNotice('Your profile was saved.');
    },
  });
  const submit = form.handleSubmit(async (values) => {
    setNotice(null);
    try {
      await mutation.mutateAsync(values);
    } catch {
      /* Mutation error is rendered below. */
    }
  });
  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
    >
      <p>
        <strong>Email:</strong> {user.email}
      </p>
      <p>
        <strong>Roles:</strong> {user.roles.join(', ')}
      </p>
      <label>
        Full name
        <input autoComplete="name" {...form.register('fullName')} />
        <FieldError message={form.formState.errors.fullName?.message} />
      </label>
      <label>
        Phone number
        <input autoComplete="tel" {...form.register('phoneNumber')} />
        <FieldError message={form.formState.errors.phoneNumber?.message} />
      </label>
      <label>
        Address
        <textarea autoComplete="street-address" {...form.register('address')} />
        <FieldError message={form.formState.errors.address?.message} />
      </label>
      <button disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save profile'}
      </button>
      {mutation.error && <p role="alert">{safeError(mutation.error)}</p>}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
function ProfileContent() {
  const { session, user } = useIdentity();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const profile = useQuery({
    queryKey: ['identity', 'profile', user!.id],
    queryFn: () => session.authorized((token) => session.api.profile(token)),
  });
  return (
    <>
      <section className="card">
        <h1>My profile</h1>
        {profile.isPending ? (
          <p role="status">Loading profile…</p>
        ) : profile.error ? (
          <p role="alert">{safeError(profile.error)}</p>
        ) : (
          <ProfileForm key={profile.data.id} user={profile.data} />
        )}
      </section>
      <section className="card">
        <h2>Link Google</h2>
        <p>
          Link a Google account with the same verified email. Confirm your
          current local password first.
        </p>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={128}
          />
        </label>
        <GoogleButton
          disabled={!password || linking}
          onToken={async (token) => {
            setLinking(true);
            setMessage(null);
            const suppliedPassword = password;
            setPassword('');
            try {
              const result = await session.authorized(
                (access) => session.api.link(access, token, suppliedPassword),
                true,
              );
              session.updateUser(result);
              setMessage('Google was linked to your account.');
            } catch (cause) {
              setMessage(safeError(cause));
              throw cause;
            } finally {
              setLinking(false);
            }
          }}
        />
        {message && <p role="status">{message}</p>}
      </section>
      <section className="card">
        <h2>Session</h2>
        <button
          disabled={loggingOut}
          onClick={() => {
            setLoggingOut(true);
            void session
              .logout()
              .then(() => {
                window.google?.accounts.id.disableAutoSelect();
                return navigate('/login', { replace: true });
              })
              .catch((cause) => {
                setMessage(safeError(cause));
                return navigate('/login', {
                  replace: true,
                  state: { logoutError: safeError(cause) },
                });
              });
          }}
        >
          Sign out
        </button>
      </section>
    </>
  );
}
export function ProfilePage() {
  return (
    <IdentityShell>
      <Protected>
        <ProfileContent />
      </Protected>
    </IdentityShell>
  );
}
