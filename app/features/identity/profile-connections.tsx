import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Alert } from '~/shared/components/ui/alert';
import { Badge } from '~/shared/components/ui/badge';
import { Button } from '~/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '~/shared/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '~/shared/components/ui/field';
import { Input } from '~/shared/components/ui/input';
import { Separator } from '~/shared/components/ui/separator';
import { Skeleton } from '~/shared/components/ui/skeleton';
import type { Profile, SignInMethods } from './contracts';
import { registrationSchema } from './contracts';
import { safeError } from './components';
import { GoogleButton } from './google-button';
import { useIdentity } from './session';

const passwordSchema = z
  .object({
    password: registrationSchema.shape.password,
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: 'Passwords do not match.',
    path: ['confirmation'],
  });

function ConnectGoogle({
  connected,
  onBusyChange,
}: {
  connected: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const { session } = useIdentity();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card
      className="space-y-4 rounded-lg border bg-muted/30 p-4"
      aria-label="Connect Google"
    >
      <p className="text-sm text-muted-foreground">
        Confirm your current password, then choose the Google account with the
        same verified email.
      </p>
      <Field>
        <FieldLabel htmlFor="link-password">Current password</FieldLabel>
        <div className="relative">
          <Input
            id="link-password"
            type={visible ? 'text' : 'password'}
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            disabled={busy}
            className="pr-12"
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 h-9 w-10"
            disabled={busy}
            aria-label={
              visible ? 'Hide current password' : 'Show current password'
            }
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        </div>
      </Field>
      <GoogleButton
        text="continue_with"
        disabled={!password || busy}
        onToken={async (token) => {
          const supplied = password;
          setPassword('');
          setBusy(true);
          onBusyChange(true);
          setError(null);
          try {
            const profile = await session.authorized(
              (access) => session.api.link(access, token, supplied),
              true,
            );
            session.updateUser(profile);
            await connected();
          } catch (cause) {
            setError(safeError(cause));
            throw cause;
          } finally {
            setBusy(false);
            onBusyChange(false);
          }
        }}
      />
      {error && <Alert variant="destructive">{error}</Alert>}
    </Card>
  );
}

function AddPassword({
  email,
  connected,
  onBusyChange,
}: {
  email: string;
  connected: (methods: SignInMethods) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const { session } = useIdentity();
  const [confirming, setConfirming] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmation: '' },
  });
  return (
    <Card
      className="space-y-4 rounded-lg border bg-muted/30 p-4"
      aria-label="Add password"
    >
      <p className="text-sm text-muted-foreground">
        Add password sign-in for{' '}
        <span className="break-all font-medium text-foreground">{email}</span>.
        Your Google account stays connected.
      </p>
      {confirming ? (
        <>
          <div className="flex items-start gap-2 text-sm">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            Confirm the Google account already connected to SwiftDrop to save
            your password.
          </div>
          <GoogleButton
            text="continue_with"
            disabled={busy}
            onToken={async (token) => {
              const password = form.getValues('password');
              form.reset();
              setBusy(true);
              onBusyChange(true);
              setError(null);
              try {
                const methods = await session.authorized(
                  (access) => session.api.addPassword(access, token, password),
                  true,
                );
                await connected(methods);
              } catch (cause) {
                setConfirming(false);
                setError(safeError(cause));
                throw cause;
              } finally {
                setBusy(false);
                onBusyChange(false);
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              form.reset();
              setConfirming(false);
            }}
          >
            Choose a different password
          </Button>
        </>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit(() => {
              setError(null);
              setConfirming(true);
            })(event);
          }}
        >
          <Field data-invalid={!!form.formState.errors.password}>
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <div className="relative">
              <Input
                id="new-password"
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                maxLength={128}
                className="pr-12"
                autoFocus
                aria-invalid={!!form.formState.errors.password}
                aria-describedby="new-password-help new-password-error"
                {...form.register('password')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 h-9 w-10"
                aria-label={visible ? 'Hide new password' : 'Show new password'}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </Button>
            </div>
            <FieldDescription id="new-password-help">
              Use 12 to 128 characters.
            </FieldDescription>
            <FieldError
              id="new-password-error"
              errors={[form.formState.errors.password]}
            />
          </Field>
          <Field data-invalid={!!form.formState.errors.confirmation}>
            <FieldLabel htmlFor="confirm-new-password">
              Confirm new password
            </FieldLabel>
            <Input
              id="confirm-new-password"
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              maxLength={128}
              aria-invalid={!!form.formState.errors.confirmation}
              aria-describedby="confirm-new-password-error"
              {...form.register('confirmation')}
            />
            <FieldError
              id="confirm-new-password-error"
              errors={[form.formState.errors.confirmation]}
            />
          </Field>
          <Button type="submit">Continue to Google confirmation</Button>
        </form>
      )}
      {error && <Alert variant="destructive">{error}</Alert>}
    </Card>
  );
}

export function ProfileConnections({ account }: { account: Profile }) {
  const { session } = useIdentity();
  const queries = useQueryClient();
  const trigger = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const key = ['identity', 'sign-in-methods', account.id];
  const methods = useQuery({
    queryKey: key,
    queryFn: () =>
      session.authorized((access) => session.api.signInMethods(access)),
  });
  const close = () => {
    setEditing(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  const connected = async (value?: SignInMethods) => {
    if (value) queries.setQueryData(key, value);
    else await methods.refetch();
    setNotice(
      value
        ? 'Password sign-in is now enabled. You can use either method.'
        : 'Google was linked to your account.',
    );
    close();
    void queries.invalidateQueries({
      queryKey: ['identity', 'profile', account.id],
    });
  };
  return (
    <Card className="min-w-0" aria-labelledby="sign-in-heading">
      <CardHeader>
        <h2 id="sign-in-heading" className="text-lg font-semibold">
          Sign-in methods
        </h2>
        <CardDescription>
          Manage how you sign in to this SwiftDrop account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {methods.isPending ? (
          <div role="status" className="space-y-4">
            <span className="sr-only">Loading sign-in methods...</span>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : methods.isError ? (
          <div className="space-y-3">
            <Alert variant="destructive">
              Sign-in methods could not be loaded. Please try again.
            </Alert>
            <Button
              type="button"
              variant="outline"
              disabled={methods.isFetching}
              onClick={() => {
                void methods.refetch();
              }}
            >
              {methods.isFetching && (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              Retry sign-in methods
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <KeyRound
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium">Email and password</p>
                  <p className="text-xs text-muted-foreground">
                    {methods.data.hasPassword
                      ? 'Password sign-in is enabled.'
                      : 'No password has been set.'}
                  </p>
                </div>
              </div>
              <Badge
                variant={methods.data.hasPassword ? 'secondary' : 'outline'}
              >
                {methods.data.hasPassword && (
                  <Check className="mr-1 size-3" aria-hidden="true" />
                )}
                {methods.data.hasPassword ? 'Enabled' : 'Not connected'}
              </Badge>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link2
                  className="size-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium">Google</p>
                  <p className="text-xs text-muted-foreground">
                    {methods.data.googleLinked
                      ? 'Your Google account is connected.'
                      : 'Connect Google for another way to sign in.'}
                  </p>
                </div>
              </div>
              <Badge
                variant={methods.data.googleLinked ? 'secondary' : 'outline'}
              >
                {methods.data.googleLinked && (
                  <Check className="mr-1 size-3" aria-hidden="true" />
                )}
                {methods.data.googleLinked ? 'Connected' : 'Not connected'}
              </Badge>
            </div>
            {((!methods.data.googleLinked && methods.data.hasPassword) ||
              (!methods.data.hasPassword && methods.data.googleLinked)) && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  ref={trigger}
                  disabled={busy}
                  aria-expanded={editing}
                  aria-controls="connection-editor"
                  onClick={() => {
                    setNotice(null);
                    setEditing(!editing);
                  }}
                >
                  {editing
                    ? 'Cancel connecting'
                    : methods.data.hasPassword
                      ? 'Connect Google'
                      : 'Add password'}
                </Button>
                {editing && (
                  <div id="connection-editor">
                    {methods.data.hasPassword ? (
                      <ConnectGoogle
                        connected={() => connected()}
                        onBusyChange={setBusy}
                      />
                    ) : (
                      <AddPassword
                        email={account.email}
                        connected={connected}
                        onBusyChange={setBusy}
                      />
                    )}
                  </div>
                )}
              </>
            )}
            {!methods.data.googleLinked && !methods.data.hasPassword && (
              <Alert>
                We could not confirm an available sign-in method. Contact your
                administrator before changing account access.
              </Alert>
            )}
          </>
        )}
        {notice && <Alert role="status">{notice}</Alert>}
      </CardContent>
    </Card>
  );
}
