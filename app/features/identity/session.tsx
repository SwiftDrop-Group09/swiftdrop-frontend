import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IdentityApi, IdentityError, responseFailure } from './api';
import type { AuthenticatedRequest, Profile, TokenPair } from './contracts';

type Snapshot = {
  user: Profile | null;
  restoring: boolean;
  error: string | null;
};
export class IdentitySession {
  private token: string | null = null;
  private expiresAt = 0;
  private generation = 0;
  private refreshFlight: Promise<string> | null = null;
  private restoreFlight: Promise<void> | null = null;
  private snapshot: Snapshot = { user: null, restoring: true, error: null };
  private readonly listeners = new Set<() => void>();
  constructor(
    readonly api: IdentityApi,
    private readonly clearPrivateCache: () => void = () => {},
    private readonly clock = Date.now,
  ) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(change: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    this.listeners.forEach((listener) => listener());
  }
  private accept(pair: TokenPair, generation: number) {
    if (this.generation !== generation)
      throw new IdentityError('session_changed');
    if (
      this.snapshot.user?.id !== pair.user.id ||
      this.snapshot.user.roles.toSorted().join() !==
        pair.user.roles.toSorted().join()
    )
      this.clearPrivateCache();
    this.token = pair.accessToken;
    this.expiresAt = this.clock() + pair.expiresInSeconds * 1000;
    this.publish({ user: pair.user, restoring: false, error: null });
    return pair.accessToken;
  }
  private clear(error: string | null = null) {
    this.generation++;
    this.token = null;
    this.expiresAt = 0;
    this.clearPrivateCache();
    this.publish({ user: null, restoring: false, error });
  }
  restore() {
    this.restoreFlight ??= this.refresh()
      .then(() => {})
      .catch((error) => {
        this.publish({
          restoring: false,
          error:
            error instanceof IdentityError && error.status === 401
              ? null
              : 'Session restoration is unavailable. You can sign in again.',
        });
      });
    return this.restoreFlight;
  }
  async login(email: string, password: string) {
    const generation = ++this.generation;
    this.accept(await this.api.login(email, password), generation);
  }
  async google(idToken: string) {
    const generation = ++this.generation;
    this.accept(await this.api.google(idToken), generation);
  }
  refresh() {
    this.refreshFlight ??= (async () => {
      const generation = this.generation;
      try {
        return this.accept(await this.api.refresh(), generation);
      } catch (error) {
        if (generation === this.generation) this.clear();
        throw error;
      } finally {
        this.refreshFlight = null;
      }
    })();
    return this.refreshFlight;
  }
  async accessToken() {
    if (!this.token || this.clock() >= this.expiresAt - 30_000)
      return this.refresh();
    return this.token;
  }
  async logout() {
    let token = this.token;
    try {
      token = await this.accessToken();
    } catch {
      /* Local state is cleared even if refresh cannot complete. */
    }
    this.clear();
    if (!token) throw new IdentityError('logout_unconfirmed');
    try {
      await this.api.logout(token);
    } catch {
      throw new IdentityError('logout_unconfirmed');
    }
  }
  updateUser(user: Profile) {
    if (!user.isActive) {
      this.clear();
      return;
    }
    if (
      this.snapshot.user?.roles.toSorted().join() !==
      user.roles.toSorted().join()
    )
      this.clearPrivateCache();
    this.publish({ user });
  }
  async authorized<T>(
    operation: (token: string) => Promise<T>,
    preserveCredentialFailure = false,
  ) {
    const generation = this.generation;
    try {
      const token = await this.accessToken();
      if (generation !== this.generation)
        throw new IdentityError('session_changed');
      const result = await operation(token);
      if (generation !== this.generation)
        throw new IdentityError('session_changed');
      return result;
    } catch (error) {
      if (
        generation === this.generation &&
        error instanceof IdentityError &&
        ((error.status === 401 && !preserveCredentialFailure) ||
          error.status === 403)
      )
        this.clear(error.message);
      throw error;
    }
  }
  readonly authenticatedRequest: AuthenticatedRequest = async (
    input,
    init = {},
  ) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      window.location.origin,
    );
    if (
      url.origin !== window.location.origin ||
      !url.pathname.startsWith(this.api.base + '/')
    )
      throw new IdentityError('forbidden');
    const generation = this.generation;
    const headers = new Headers(
      input instanceof Request ? input.headers : undefined,
    );
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    headers.set('Authorization', `Bearer ${await this.accessToken()}`);
    if (generation !== this.generation)
      throw new IdentityError('session_changed');
    const method = (
      init.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    let response = await fetch(input, {
      ...init,
      headers,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
    });
    if (generation !== this.generation)
      throw new IdentityError('session_changed');
    if (response.status === 401 && method === 'GET') {
      headers.set('Authorization', `Bearer ${await this.refresh()}`);
      response = await fetch(input, {
        ...init,
        headers,
        credentials: 'include',
        cache: 'no-store',
        redirect: 'error',
      });
      if (generation !== this.generation)
        throw new IdentityError('session_changed');
    }
    if (response.status === 401) {
      this.clear();
      throw await responseFailure(response);
    }
    return response;
  };
}
const SessionContext = createContext<IdentitySession | null>(null);
export function IdentityProvider({
  children,
  session: supplied,
}: {
  children: ReactNode;
  session?: IdentitySession;
}) {
  const queries = useQueryClient();
  const [session] = useState(
    () =>
      supplied ??
      new IdentitySession(
        new IdentityApi(undefined, import.meta.env.VITE_API_BASE_URL ?? '/api'),
        () => queries.clear(),
      ),
  );
  useEffect(() => {
    void session.restore();
  }, [session]);
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
export function useIdentity() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('IdentityProvider is required.');
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return { ...snapshot, session };
}
