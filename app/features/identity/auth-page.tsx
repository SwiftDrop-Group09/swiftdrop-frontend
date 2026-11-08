import { Eye, EyeOff, LoaderCircle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registrationSchema, loginSchema } from './contracts';
import { safeError } from './components';
import { GoogleButton } from './google-button';
import { useIdentity } from './session';
import { AuthLayout } from './auth-layout';
import { Button } from '~/shared/components/ui/button';
import { Input } from '~/shared/components/ui/input';
import { Alert } from '~/shared/components/ui/alert';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '~/shared/components/ui/field';

const signupSchema = registrationSchema
  .extend({ confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
type Values = z.infer<typeof registrationSchema> & { confirmPassword: string };

export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, restoring, session } = useIdentity();
  const navigate = useNavigate();
  const location = useLocation();
  const logoutNotice = z
    .object({ logoutError: z.string() })
    .safeParse(location.state);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(
      register
        ? signupSchema
        : loginSchema.extend({
            fullName: z.string(),
            confirmPassword: z.string(),
          }),
    ),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      confirmPassword: '',
    },
  });
  if (user) return <Navigate to="/dashboard" replace />;
  const pending = form.formState.isSubmitting || restoring || googleBusy;
  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      if (register) {
        // Registration returns a profile, so a separate successful login establishes the session.
        await session.api.register(
          values.email,
          values.password,
          values.fullName,
        );
        setRegistered(true);
      }
      await session.login(values.email, values.password);
      await navigate('/dashboard', { replace: true });
    } catch (cause) {
      setError(safeError(cause));
    } finally {
      form.resetField('password');
      form.resetField('confirmPassword');
    }
  });
  return (
    <AuthLayout register={register}>
      <div className="flex flex-col gap-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {registered
              ? 'Your account is ready'
              : register
                ? 'Create your account'
                : 'Welcome back'}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {registered
              ? 'Sign in to open your SwiftDrop workspace.'
              : register
                ? 'Everything you need to get started.'
                : 'Sign in to your SwiftDrop account to continue.'}
          </p>
        </div>
        {restoring && (
          <p
            role="status"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Checking for an existing session...
          </p>
        )}
        {error && <Alert variant="destructive">{error}</Alert>}
        {logoutNotice.success && (
          <Alert variant="destructive">{logoutNotice.data.logoutError}</Alert>
        )}
        {registered ? (
          <div className="space-y-5">
            <Alert role="status">
              <CheckCircle2 className="size-4" />
              <span>Your account was created. Sign in to continue.</span>
            </Alert>
            <Button asChild className="w-full">
              <Link to="/login" replace>
                Go to sign in
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <form
              className="flex flex-col gap-6"
              onSubmit={(event) => {
                void submit(event);
              }}
              noValidate
              aria-busy={form.formState.isSubmitting}
            >
              <FieldGroup>
                {register && (
                  <Field data-invalid={!!form.formState.errors.fullName}>
                    <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                    <Input
                      id="full-name"
                      autoComplete="name"
                      placeholder="Alex Morgan"
                      disabled={pending}
                      aria-invalid={!!form.formState.errors.fullName}
                      aria-describedby={
                        form.formState.errors.fullName
                          ? 'full-name-error'
                          : undefined
                      }
                      {...form.register('fullName')}
                    />
                    <FieldError
                      id="full-name-error"
                      errors={[form.formState.errors.fullName]}
                    />
                  </Field>
                )}
                <Field data-invalid={!!form.formState.errors.email}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@example.com"
                    disabled={pending}
                    aria-invalid={!!form.formState.errors.email}
                    aria-describedby={
                      form.formState.errors.email ? 'email-error' : undefined
                    }
                    {...form.register('email')}
                  />
                  <FieldError
                    id="email-error"
                    errors={[form.formState.errors.email]}
                  />
                </Field>
                <Field data-invalid={!!form.formState.errors.password}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <div className="relative">
                    <Input
                      id="password"
                      className="pr-12"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={
                        register ? 'new-password' : 'current-password'
                      }
                      disabled={pending}
                      aria-invalid={!!form.formState.errors.password}
                      aria-describedby={
                        register
                          ? 'password-help password-error'
                          : form.formState.errors.password
                            ? 'password-error'
                            : undefined
                      }
                      {...form.register('password')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-9 w-10"
                      disabled={pending}
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  {register && (
                    <FieldDescription id="password-help">
                      Use 12 to 128 characters.
                    </FieldDescription>
                  )}
                  <FieldError
                    id="password-error"
                    errors={[form.formState.errors.password]}
                  />
                </Field>
                {register && (
                  <Field data-invalid={!!form.formState.errors.confirmPassword}>
                    <FieldLabel htmlFor="confirm-password">
                      Confirm password
                    </FieldLabel>
                    <Input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      disabled={pending}
                      aria-invalid={!!form.formState.errors.confirmPassword}
                      aria-describedby={
                        form.formState.errors.confirmPassword
                          ? 'confirm-password-error'
                          : undefined
                      }
                      {...form.register('confirmPassword')}
                    />
                    <FieldError
                      id="confirm-password-error"
                      errors={[form.formState.errors.confirmPassword]}
                    />
                  </Field>
                )}
                <Field>
                  <Button type="submit" className="w-full" disabled={pending}>
                    {form.formState.isSubmitting && (
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    {form.formState.isSubmitting
                      ? register
                        ? 'Creating account...'
                        : 'Signing in...'
                      : register
                        ? 'Create account'
                        : 'Sign in'}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
            <FieldSeparator className="my-0">Or continue with</FieldSeparator>
            <GoogleButton
              key={register ? 'register' : 'login'}
              text={register ? 'signup_with' : 'signin_with'}
              disabled={restoring || form.formState.isSubmitting}
              onBusyChange={setGoogleBusy}
              onToken={async (token) => {
                setError(null);
                await session.google(token);
                await navigate('/dashboard', { replace: true });
              }}
            />
            <FieldDescription className="text-center">
              {register ? (
                <>
                  Already have an account? <Link to="/login">Sign in</Link>
                </>
              ) : (
                <>
                  New to SwiftDrop?{' '}
                  <Link to="/register">Create a Customer account</Link>
                </>
              )}
            </FieldDescription>
            {register && (
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Registration creates a Customer account. Other roles are
                assigned by an administrator.
              </p>
            )}
          </>
        )}
      </div>
    </AuthLayout>
  );
}
