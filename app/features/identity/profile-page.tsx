import { Avatar, AvatarFallback } from '~/shared/components/ui/avatar';
import {
  Mail,
  ShieldCheck,
  UserRound,
  Check,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IdentityShell, Protected, safeError } from './components';
import { profileInputSchema } from './contracts';
import type { Profile, ProfileInput } from './contracts';
import { ProfileConnections } from './profile-connections';
import { useIdentity } from './session';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Textarea } from '~/shared/components/ui/textarea';
import { Alert } from '~/shared/components/ui/alert';
import { Badge } from '~/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardFooter,
} from '~/shared/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '~/shared/components/ui/field';
import { Skeleton } from '~/shared/components/ui/skeleton';

const roleDetails = {
  Customer: 'Parcel booking, tracking, delivery history and receipts.',
  Courier: 'Assigned deliveries, delivery updates and proof of delivery.',
  Merchant: 'Business orders, API keys and webhook integrations.',
  Dispatcher: 'Courier assignments, workload and delivery zone summaries.',
  Admin: 'User access, merchant approvals, delivery configuration and reports.',
} satisfies Record<Profile['roles'][number], string>;

function valuesFor(user: Profile): ProfileInput {
  return {
    fullName: user.fullName,
    phoneNumber: user.phoneNumber ?? '',
    address: user.address ?? '',
  };
}

function ProfileForm({ user }: { user: Profile }) {
  const { session } = useIdentity();
  const queries = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: valuesFor(user),
  });
  const mutation = useMutation({
    mutationFn: (input: ProfileInput) =>
      session.authorized((token) => session.api.updateProfile(token, input)),
    onSuccess: (value) => {
      session.updateUser(value);
      queries.setQueryData(['identity', 'profile', value.id], value);
      form.reset(valuesFor(value));
      setNotice('Your profile was saved.');
    },
  });
  const submit = form.handleSubmit(async (values) => {
    setNotice(null);
    try {
      await mutation.mutateAsync(values);
    } catch {
      /* Render the safe mutation error below. */
    }
  });
  const addressHelp = user.roles.includes('Courier')
    ? 'Your contact address. Courier service zones are managed separately.'
    : user.roles.includes('Merchant')
      ? 'Your personal contact address. Business registration details are managed separately.'
      : user.roles.includes('Customer')
        ? 'Your contact address. Enter pickup and delivery addresses separately when booking.'
        : 'Your personal or work contact address.';
  return (
    <Card className="min-w-0" aria-labelledby="personal-details-heading">
      <CardHeader>
        <h2 id="personal-details-heading" className="text-lg font-semibold">
          Personal details
        </h2>
        <CardDescription>
          Keep your name and contact details up to date.
        </CardDescription>
      </CardHeader>
      <form
        noValidate
        aria-busy={mutation.isPending}
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <CardContent className="space-y-5">
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.fullName}>
              <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
              <Input
                id="profile-name"
                autoComplete="name"
                maxLength={120}
                disabled={mutation.isPending}
                aria-invalid={!!form.formState.errors.fullName}
                aria-describedby="profile-name-error"
                {...form.register('fullName')}
              />
              <FieldError
                id="profile-name-error"
                errors={[form.formState.errors.fullName]}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-email">Email address</FieldLabel>
              <Input
                id="profile-email"
                type="email"
                value={user.email}
                readOnly
                aria-describedby="profile-email-help"
                className="bg-muted/40"
              />
              <FieldDescription id="profile-email-help">
                This is your account email and cannot be changed here.
              </FieldDescription>
            </Field>
            <Field data-invalid={!!form.formState.errors.phoneNumber}>
              <FieldLabel htmlFor="profile-phone">
                Phone number{' '}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FieldLabel>
              <Input
                id="profile-phone"
                type="tel"
                autoComplete="tel"
                maxLength={32}
                disabled={mutation.isPending}
                aria-invalid={!!form.formState.errors.phoneNumber}
                aria-describedby="profile-phone-help profile-phone-error"
                {...form.register('phoneNumber')}
              />
              <FieldDescription id="profile-phone-help">
                Include your country code where possible.
              </FieldDescription>
              <FieldError
                id="profile-phone-error"
                errors={[form.formState.errors.phoneNumber]}
              />
            </Field>
            <Field data-invalid={!!form.formState.errors.address}>
              <FieldLabel htmlFor="profile-address">
                Address{' '}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FieldLabel>
              <Textarea
                id="profile-address"
                autoComplete="street-address"
                rows={3}
                disabled={mutation.isPending}
                aria-invalid={!!form.formState.errors.address}
                aria-describedby="profile-address-help profile-address-error"
                {...form.register('address')}
              />
              <FieldDescription id="profile-address-help">
                {addressHelp}
              </FieldDescription>
              <FieldError
                id="profile-address-error"
                errors={[form.formState.errors.address]}
              />
            </Field>
          </FieldGroup>
          {mutation.error && (
            <Alert variant="destructive">{safeError(mutation.error)}</Alert>
          )}
          {notice && !form.formState.isDirty && (
            <Alert role="status">
              <Check className="size-4" aria-hidden="true" />
              <span>{notice}</span>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-3 border-t pt-5">
          <p className="text-xs text-muted-foreground">
            {form.formState.isDirty
              ? 'You have unsaved changes.'
              : 'Your details are up to date.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={mutation.isPending || !form.formState.isDirty}
              onClick={() => {
                form.reset(valuesFor(user));
                mutation.reset();
                setNotice(null);
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset changes
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !form.formState.isDirty}
            >
              {mutation.isPending && (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {mutation.isPending ? 'Saving...' : 'Save profile'}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

function ProfileContent() {
  const { session, user } = useIdentity();
  const profile = useQuery({
    queryKey: ['identity', 'profile', user!.id],
    queryFn: () => session.authorized((token) => session.api.profile(token)),
  });
  const account = profile.data ?? user!;
  const initials =
    account.fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'SD';
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          My profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Your details, account access and connected sign-in methods.
        </p>
      </header>
      <Card>
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <Avatar className="size-16 rounded-2xl" aria-hidden="true">
            <AvatarFallback className="rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="wrap-break-word text-xl font-semibold tracking-tight">
              {account.fullName}
            </p>
            <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              <span className="break-all">{account.email}</span>
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Assigned roles">
              {account.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
          <Badge variant="outline" className="w-fit">
            <ShieldCheck className="mr-1.5 size-3.5" aria-hidden="true" />
            {account.isActive ? 'Active account' : 'Inactive account'}
          </Badge>
        </CardContent>
      </Card>
      {profile.isPending ? (
        <div role="status" className="grid gap-6 lg:grid-cols-2">
          <span className="sr-only">Loading profile...</span>
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : profile.isError ? (
        <div className="space-y-3">
          <Alert variant="destructive">{safeError(profile.error)}</Alert>
          <Button
            variant="outline"
            disabled={profile.isFetching}
            onClick={() => {
              void profile.refetch();
            }}
          >
            Retry profile
          </Button>
        </div>
      ) : (
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <ProfileForm key={profile.data.id} user={profile.data} />
          <div className="min-w-0 space-y-6">
            <ProfileConnections key={profile.data.id} account={profile.data} />
            <Card aria-labelledby="access-heading">
              <CardHeader>
                <h2 id="access-heading" className="text-lg font-semibold">
                  Your access
                </h2>
                <CardDescription>
                  Roles assigned to your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.data.roles.map((role) => (
                  <div className="flex gap-3" key={role}>
                    <UserRound
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-medium">{role}</p>
                      <p className="text-sm text-muted-foreground">
                        {roleDetails[role]}
                      </p>
                    </div>
                  </div>
                ))}
                {!profile.data.roles.length && (
                  <p className="text-sm text-muted-foreground">
                    No workspace roles are assigned. Contact your administrator
                    if you need access.
                  </p>
                )}
                {profile.data.roles.includes('Admin') && (
                  <Button asChild variant="outline">
                    <Link to="/admin/users">Manage users and roles</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
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
