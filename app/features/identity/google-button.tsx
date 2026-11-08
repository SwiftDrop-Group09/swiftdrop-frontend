import { Button } from '~/shared/components/ui/button';
import { Alert } from '~/shared/components/ui/alert';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IdentityError } from './api';
import { useIdentity } from './session';
import './google-button.css';

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
      text: 'signin_with' | 'signup_with';
      shape: 'rectangular';
      logo_alignment: 'center';
      width: string;
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
  text = 'signin_with',
  onBusyChange,
}: {
  onToken: (token: string) => Promise<void>;
  disabled?: boolean;
  text?: 'signin_with' | 'signup_with';
  onBusyChange?: (busy: boolean) => void;
}) {
  const { session } = useIdentity();
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  const alive = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
    if (!clientId || disabled) return;
    let mounted = true;
    let submitting = false;
    let sdk: GoogleSdk | undefined;
    let observer: ResizeObserver | undefined;
    const element = container.current;
    void Promise.all([loadGoogleSdk(), session.api.bootstrap(true)])
      .then(([google, bootstrap]) => {
        if (!mounted || !element) return;
        sdk = google;
        google.initialize({
          client_id: clientId,
          nonce: bootstrap.googleNonce,
          auto_select: false,
          ux_mode: 'popup',
          callback: (response) => {
            if (!mounted || submitting || !response.credential) return;
            submitting = true;
            setBusy(true);
            onBusyChange?.(true);
            setError(null);
            void callback
              .current(response.credential)
              .catch((cause: unknown) => {
                if (mounted)
                  setError(
                    cause instanceof IdentityError
                      ? cause.message
                      : 'Google sign-in could not be completed. Please try again.',
                  );
              })
              .finally(() => {
                if (alive.current) {
                  setBusy(false);
                  onBusyChange?.(false);
                  setReady(false);
                  if (mounted) setAttempt((value) => value + 1);
                }
              });
          },
        });
        let previousWidth = 0;
        const render = () => {
          if (!mounted || submitting) return;
          const width = Math.min(
            400,
            Math.floor(element.getBoundingClientRect().width) || 384,
          );
          if (width === previousWidth) return;
          previousWidth = width;
          element.replaceChildren();
          google.renderButton(element, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text,
            shape: 'rectangular',
            logo_alignment: 'center',
            width: String(width),
          });
        };
        render();
        observer = new ResizeObserver(render);
        observer.observe(element);
        setReady(true);
      })
      .catch(() => {
        if (mounted)
          setError(
            'Google sign-in could not load. Use local sign-in or try again.',
          );
      });
    return () => {
      mounted = false;
      observer?.disconnect();
      sdk?.cancel();
      element?.replaceChildren();
    };
  }, [session, attempt, disabled, text, onBusyChange]);
  const configured = !!import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  return (
    <div className="space-y-3" aria-busy={busy}>
      {configured ? (
        <>
          {!ready && !error && !disabled && (
            <p
              role="status"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
              Loading Google sign-in...
            </p>
          )}
          <div
            className="google-sign-in"
            ref={container}
            inert={disabled || busy}
            data-disabled={disabled || busy}
          />
          {busy && (
            <p
              role="status"
              className="text-center text-sm text-muted-foreground"
            >
              Verifying Google sign-in...
            </p>
          )}
          {error && (
            <>
              <Alert variant="destructive">{error}</Alert>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={disabled || busy}
                onClick={() => {
                  setError(null);
                  setReady(false);
                  setAttempt((value) => value + 1);
                }}
              >
                Retry Google sign-in
              </Button>
            </>
          )}
        </>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Google sign-in is not configured for this deployment.
        </p>
      )}
    </div>
  );
}
