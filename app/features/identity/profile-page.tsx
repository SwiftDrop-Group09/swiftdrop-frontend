import { Textarea } from '~/shared/components/ui/textarea';
import { Label } from '~/shared/components/ui/label';
import { Alert } from '~/shared/components/ui/alert';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FieldError, IdentityShell, Protected, safeError } from './components';
import { profileInputSchema } from './contracts';
import type { Profile, ProfileInput } from './contracts';
import { GoogleButton } from './google-button';
import { useIdentity } from './session';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Card } from '~/shared/components/ui/card';

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
      className="grid gap-5"
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
      <Label className="grid gap-2">
        Full name
        <Input autoComplete="name" {...form.register('fullName')} />
        <FieldError message={form.formState.errors.fullName?.message} />
      </Label>
      <Label className="grid gap-2">
        Phone number
        <Input autoComplete="tel" {...form.register('phoneNumber')} />
        <FieldError message={form.formState.errors.phoneNumber?.message} />
      </Label>
      <Label className="grid gap-2">
        Address
        <Textarea autoComplete="street-address" {...form.register('address')} />
        <FieldError message={form.formState.errors.address?.message} />
      </Label>
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save profile'}
      </Button>
      {mutation.error && (
        <Alert variant="destructive">{safeError(mutation.error)}</Alert>
      )}
      {notice && <Alert role="status">{notice}</Alert>}
    </form>
  );
}
function ProfileContent() {
  const { session, user } = useIdentity();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const profile = useQuery({
    queryKey: ['identity', 'profile', user!.id],
    queryFn: () => session.authorized((token) => session.api.profile(token)),
  });
  return (
    <>
      <section>
        <Card className="mx-auto w-full max-w-2xl space-y-5 p-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            My profile
          </h1>
          {profile.isPending ? (
            <Alert role="status">Loading profile…</Alert>
          ) : profile.error ? (
            <Alert variant="destructive">{safeError(profile.error)}</Alert>
          ) : (
            <ProfileForm key={profile.data.id} user={profile.data} />
          )}
        </Card>
      </section>
      <section>
        <Card className="mx-auto w-full max-w-2xl space-y-5 p-6">
          <h2 className="text-xl font-semibold tracking-tight">Link Google</h2>
          <p>
            Link a Google account with the same verified email. Confirm your
            current local password first.
          </p>
          <Label className="grid gap-2">
            Current password
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              maxLength={128}
            />
          </Label>
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
          {message && <Alert role="status">{message}</Alert>}
        </Card>
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
