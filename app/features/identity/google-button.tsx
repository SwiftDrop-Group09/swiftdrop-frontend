import { useEffect, useRef, useState } from 'react';
import { IdentityError } from './api';
import { useIdentity } from './session';

type GoogleSdk = {
  initialize(options: {
    client_id: string;
    nonce: string;
    auto_select: boolean;
    ux_mode: 'popup';
    callback: (response: { credential?: string }) => void;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline';
      size: 'large';
      text: 'signin_with';
    },
  ): void;
  cancel(): void;
  disableAutoSelect(): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleSdk } };
  }
}
let loading: Promise<GoogleSdk> | null = null;
export function loadGoogleSdk(): Promise<GoogleSdk> {
  if (window.google?.accounts.id)
    return Promise.resolve(window.google.accounts.id);
  loading ??= new Promise<GoogleSdk>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timer = window.setTimeout(() => {
      loading = null;
      script.remove();
      reject(new IdentityError('google_unavailable'));
    }, 15_000);
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.google?.accounts.id) resolve(window.google.accounts.id);
      else {
        loading = null;
        reject(new IdentityError('google_unavailable'));
      }
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      loading = null;
      script.remove();
      reject(new IdentityError('google_unavailable'));
    };
    document.head.append(script);
  });
  return loading;
}

export function GoogleButton({
  onToken,
  disabled = false,
}: {
  onToken: (token: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { session } = useIdentity();
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
    if (!clientId || disabled) return;
    let mounted = true;
    let sdk: GoogleSdk | undefined;
    void Promise.all([loadGoogleSdk(), session.api.bootstrap(true)])
      .then(([google, bootstrap]) => {
        if (!mounted || !container.current) return;
        sdk = google;
        google.initialize({
          client_id: clientId,
          nonce: bootstrap.googleNonce,
          auto_select: false,
          ux_mode: 'popup',
          callback: (response) => {
            if (!mounted || !response.credential) return;
            setBusy(true);
            setError(null);
            void callback
              .current(response.credential)
              .catch(() => {
                /* Parent presents safe provider/link outcome. */
              })
              .finally(() => {
                if (mounted) {
                  setBusy(false);
                  setAttempt((value) => value + 1);
                }
              });
          },
        });
        google.renderButton(container.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
        });
      })
      .catch(() => {
        if (mounted)
          setError(
            'Google sign-in could not load. Use local sign-in or try again.',
          );
      });
    const element = container.current;
    return () => {
      mounted = false;
      sdk?.cancel();
      element?.replaceChildren();
    };
  }, [session, attempt, disabled]);
  if (!import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID)
    return <p>Google sign-in is not configured for this deployment.</p>;
  return (
    <div className="google-signin" aria-busy={busy}>
      <div ref={container} inert={disabled || busy} />
      {disabled && <p>Enter your current password to enable Google linking.</p>}
      {busy && <p role="status">Verifying Google sign-in…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Retry Google sign-in
          </button>
        </>
      )}
    </div>
  );
}
