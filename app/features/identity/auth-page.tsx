import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registrationSchema, loginSchema } from './contracts';
import { FieldError, IdentityShell, safeError } from './components';
import { GoogleButton } from './google-button';
import { useIdentity } from './session';

type Values = z.infer<typeof registrationSchema>;
export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, restoring, session } = useIdentity();
  const navigate = useNavigate();
  const location = useLocation();
  const logoutNotice = z
    .object({ logoutError: z.string() })
    .safeParse(location.state);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(
      register
        ? registrationSchema
        : loginSchema.extend({ fullName: z.string() }),
    ),
    defaultValues: { email: '', password: '', fullName: '' },
  });
  if (user) return <Navigate to="/profile" replace />;
  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      if (register) {
        await session.api.register(
          values.email,
          values.password,
          values.fullName,
        );
        setRegistered(true);
        form.reset();
      } else {
        await session.login(values.email, values.password);
        await navigate('/profile', { replace: true });
      }
    } catch (cause) {
      setError(safeError(cause));
    } finally {
      form.resetField('password');
    }
  });
  return (
    <IdentityShell>
      <section className="card auth-card">
        <p className="eyebrow">Your SwiftDrop account</p>
        <h1>{register ? 'Create a Customer account' : 'Welcome back'}</h1>
        {restoring && <p role="status">Checking for an existing session…</p>}
        {registered && (
          <p role="status">
            Your account was created.{' '}
            <Link to="/login">Sign in to continue.</Link>
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {logoutNotice.success && (
          <p role="alert">{logoutNotice.data.logoutError}</p>
        )}
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          noValidate
        >
          {register && (
            <label>
              Full name
              <input autoComplete="name" {...form.register('fullName')} />
              <FieldError message={form.formState.errors.fullName?.message} />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              {...form.register('email')}
            />
            <FieldError message={form.formState.errors.email?.message} />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              {...form.register('password')}
            />
            <FieldError message={form.formState.errors.password?.message} />
          </label>
          {register && (
            <p>
              Use a password with 12–128 characters. Registration creates a
              Customer account.
            </p>
          )}
          <button disabled={form.formState.isSubmitting || restoring}>
            {form.formState.isSubmitting
              ? 'Please wait…'
              : register
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
        {!register && (
          <GoogleButton
            disabled={restoring || form.formState.isSubmitting}
            onToken={async (token) => {
              setError(null);
              try {
                await session.google(token);
                await navigate('/profile', { replace: true });
              } catch (cause) {
                setError(safeError(cause));
                throw cause;
              }
            }}
          />
        )}
        <p>
          {register ? (
            <>
              Already registered? <Link to="/login">Sign in</Link>
            </>
          ) : (
            <>
              New to SwiftDrop?{' '}
              <Link to="/register">Create a Customer account</Link>
            </>
          )}
        </p>
      </section>
    </IdentityShell>
  );
}
