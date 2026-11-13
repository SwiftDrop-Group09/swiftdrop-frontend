import {
  NativeSelect,
  NativeSelectOption,
} from '~/shared/components/ui/native-select';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { adminInputSchema, roles, type Profile } from './contracts';
import { FieldError, safeError } from './components';
import { useIdentity } from './session';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Label } from '~/shared/components/ui/label';
import { Checkbox } from '~/shared/components/ui/checkbox';
import { Alert } from '~/shared/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '~/shared/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '~/shared/components/ui/alert-dialog';

type Confirmation = {
  title: string;
  description: string;
  execute: () => Promise<void>;
};
type EditorProps = {
  saved: (profile: Profile, message: string) => void;
  close: () => void;
};
function ConfirmChange({
  value,
  close,
  pending,
  error,
  confirm,
  afterClose,
}: {
  value: Confirmation | null;
  close: () => void;
  pending: boolean;
  error: unknown;
  confirm: () => void;
  afterClose?: () => void;
}) {
  return (
    <AlertDialog
      open={!!value}
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={
          afterClose
            ? (event) => {
                event.preventDefault();
                afterClose();
              }
            : undefined
        }
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{value?.title}</AlertDialogTitle>
          <AlertDialogDescription>{value?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <Alert variant="destructive">{safeError(error)}</Alert> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            {pending ? 'Saving…' : 'Confirm change'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const accountSchema = adminInputSchema.extend({ password: z.string() });
const createSchema = accountSchema.extend({
  password: z.string().min(12, 'Use at least 12 characters.').max(128),
});
type AccountInput = z.infer<typeof accountSchema>;
const roleDescriptions: Record<Profile['roles'][number], string> = {
  Customer: 'Book deliveries and manage their own parcels, receipts and proof.',
  Courier: 'View assigned deliveries and submit delivery updates and proof.',
  Merchant: 'Manage an approved business, API keys and webhooks as its owner.',
  Dispatcher:
    'Track all parcels and view operational history and zone summaries.',
  Admin: 'Manage users, approvals, zones, pricing, reports and audit logs.',
};

export function AccountEditor({
  profile,
  initialRole = 'Customer',
  saved,
  close,
}: EditorProps & {
  profile?: Profile;
  initialRole?: Profile['roles'][number];
}) {
  const { session, user } = useIdentity();
  const [reveal, setReveal] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const form = useForm<AccountInput>({
    resolver: zodResolver(profile ? accountSchema : createSchema),
    defaultValues: {
      email: profile?.email ?? '',
      fullName: profile?.fullName ?? '',
      isActive: profile?.isActive ?? true,
      password: '',
    },
  });
  const mutation = useMutation({
    mutationFn: (execute: () => Promise<void>) => execute(),
    retry: false,
    onSuccess: () => setConfirmation(null),
  });
  const submit = form.handleSubmit(({ email, fullName, isActive }) => {
    mutation.reset();
    setConfirmation({
      title: profile
        ? `Save changes for ${profile.fullName}?`
        : `Create ${initialRole.toLowerCase()} account?`,
      description: profile
        ? 'The account details will be updated. Changes to your own account status will refresh your session.'
        : `This account will have the ${initialRole} role. Share the initial password privately. Each account has one role.`,
      execute: async () => {
        try {
          const result = await session.authorized((token) =>
            profile
              ? session.api.updateUser(token, profile.id, {
                  email,
                  fullName,
                  isActive,
                })
              : session.api.createUser(token, {
                  email,
                  fullName,
                  isActive,
                  password: form.getValues('password'),
                  role: initialRole,
                }),
          );
          if (result.id === user?.id) {
            session.updateUser(result);
            if (result.isActive !== profile?.isActive) {
              try {
                await session.refresh();
              } catch {
                /* Accepted changes can revoke this session. */
              }
            }
          }
          saved(
            result,
            profile
              ? 'Account details saved.'
              : `${initialRole} account created.`,
          );
        } finally {
          form.resetField('password');
          setReveal(false);
          if (!profile) setConfirmation(null);
        }
      },
    });
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) close();
      }}
    >
      <DialogContent
        className="max-h-[90svh] w-[calc(100%-2rem)] overflow-y-auto"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {profile ? 'Edit account' : `Add ${initialRole.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>
            {profile
              ? `Update ${profile.email}.`
              : `Create an account with the ${initialRole} role.`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            void submit(event);
          }}
          noValidate
        >
          <fieldset className="grid gap-5" disabled={mutation.isPending}>
            <Label className="grid gap-2">
              Full name
              <Input autoComplete="off" {...form.register('fullName')} />
              <FieldError message={form.formState.errors.fullName?.message} />
            </Label>
            <Label className="grid gap-2">
              Email
              <Input
                type="email"
                autoComplete="off"
                {...form.register('email')}
              />
              <FieldError message={form.formState.errors.email?.message} />
            </Label>
            {!profile && (
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="new-user-password">Initial password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-user-password"
                      type={reveal ? 'text' : 'password'}
                      autoComplete="new-password"
                      {...form.register('password')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={reveal ? 'Hide password' : 'Show password'}
                      onClick={() => setReveal(!reveal)}
                    >
                      {reveal ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                  <FieldError
                    message={form.formState.errors.password?.message}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    form.setValue(
                      'password',
                      btoa(
                        String.fromCharCode(
                          ...crypto.getRandomValues(new Uint8Array(24)),
                        ),
                      )
                        .replaceAll('+', '-')
                        .replaceAll('/', '_'),
                      { shouldValidate: true },
                    );
                  }}
                >
                  Generate password
                </Button>
                <p className="text-xs text-muted-foreground">
                  Use at least 12 characters. The password is cleared after each
                  submission and cannot be retrieved later.
                </p>
              </div>
            )}
            <Label className="flex items-center gap-2">
              <Controller
                name="isActive"
                control={form.control}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(value) => field.onChange(value === true)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                )}
              />
              Account active
            </Label>
          </fieldset>
          {mutation.error && !confirmation && (
            <Alert variant="destructive">{safeError(mutation.error)}</Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={close}
            >
              Cancel
            </Button>
            <Button disabled={mutation.isPending}>
              {profile ? 'Review changes' : 'Review new account'}
            </Button>
          </DialogFooter>
        </form>
        <ConfirmChange
          value={confirmation}
          pending={mutation.isPending}
          error={mutation.error}
          close={() => {
            setConfirmation(null);
            mutation.reset();
          }}
          confirm={() => {
            if (confirmation) mutation.mutate(confirmation.execute);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function AccessEditor({
  profile,
  kind,
  saved,
  close,
}: EditorProps & { profile: Profile; kind: 'roles' | 'status' }) {
  const { session, user } = useIdentity();
  const [stage, setStage] = useState<
    'edit' | 'leaving' | 'confirm' | 'returning'
  >('edit');
  const [selectedRoles, setSelectedRoles] = useState(profile.roles);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const mutation = useMutation({
    retry: false,
    mutationFn: (execute: () => Promise<void>) => execute(),
  });
  const self = profile.id === user?.id;
  const save = async () => {
    const result = await session.authorized(async (token) => {
      if (kind === 'roles')
        return session.api.setRoles(token, profile.id, selectedRoles);
      if (profile.isActive) {
        await session.api.deactivate(token, profile.id);
        return { ...profile, isActive: false };
      }
      return session.api.updateUser(token, profile.id, {
        ...profile,
        isActive: true,
      });
    });
    if (self) {
      session.updateUser(result);
      try {
        await session.refresh();
      } catch {
        /* Accepted changes can revoke this session. */
      }
    }
    saved(
      result,
      kind === 'roles'
        ? 'Role updated.'
        : `Account ${result.isActive ? 'reactivated' : 'deactivated'}.`,
    );
  };
  const review = () => {
    mutation.reset();
    setStage('leaving');
    setConfirmation({
      title:
        kind === 'roles'
          ? `Change role for ${profile.fullName}?`
          : `${profile.isActive ? 'Deactivate' : 'Reactivate'} ${profile.fullName}?`,
      description: `${kind === 'roles' ? `Selected role: ${selectedRoles.join(', ') || 'None'}. Access changes apply when sessions refresh.` : profile.isActive ? 'This user will lose access and their sessions will be revoked.' : 'This user will be able to sign in again.'}${self ? ' You are changing your own account. You may lose access to this page.' : ''} The last active Admin cannot be removed.`,
      execute: save,
    });
  };
  return (
    <>
      <Dialog
        open={stage === 'edit'}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) close();
        }}
      >
        <DialogContent
          className="max-h-[90svh] w-[calc(100%-2rem)] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            setStage((current) =>
              current === 'leaving' ? 'confirm' : current,
            );
          }}
          onEscapeKeyDown={(event) => {
            if (mutation.isPending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {kind === 'roles' ? 'Manage role' : 'Account status'}
            </DialogTitle>
            <DialogDescription>
              {profile.fullName} · {profile.email}
            </DialogDescription>
          </DialogHeader>
          {kind === 'roles' ? (
            <div className="space-y-3">
              <Label htmlFor="account-role">Account role</Label>
              <NativeSelect
                id="account-role"
                value={selectedRoles[0] ?? ''}
                disabled={mutation.isPending}
                onChange={(event) =>
                  setSelectedRoles([
                    event.target.value as Profile['roles'][number],
                  ])
                }
              >
                {roles.map((role) => (
                  <NativeSelectOption key={role} value={role}>
                    {role}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <p className="text-sm text-muted-foreground">
                {roleDescriptions[selectedRoles[0] ?? 'Customer']}
              </p>
              <p className="text-xs text-muted-foreground">
                Each account has one role. Changing it replaces the previous
                role.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This account is currently{' '}
              <strong>{profile.isActive ? 'active' : 'inactive'}</strong>.{' '}
              {profile.isActive
                ? 'Deactivation prevents sign-in and ends existing sessions.'
                : 'Reactivation restores sign-in access with the existing roles.'}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              variant={
                kind === 'status' && profile.isActive
                  ? 'destructive'
                  : 'default'
              }
              disabled={
                mutation.isPending ||
                (kind === 'roles' &&
                  [...selectedRoles].sort().join() ===
                    [...profile.roles].sort().join())
              }
              onClick={review}
            >
              {kind === 'roles'
                ? 'Review role change'
                : profile.isActive
                  ? 'Deactivate account'
                  : 'Reactivate account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmChange
        value={stage === 'confirm' ? confirmation : null}
        afterClose={() =>
          setStage((current) => (current === 'returning' ? 'edit' : current))
        }
        pending={mutation.isPending}
        error={mutation.error}
        close={() => {
          setConfirmation(null);
          setStage('returning');
          mutation.reset();
        }}
        confirm={() => {
          if (confirmation) mutation.mutate(confirmation.execute);
        }}
      />
    </>
  );
}
