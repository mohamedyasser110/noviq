/* ============================================================
   NOVIQ — client session state (single source of truth)
   ------------------------------------------------------------
   The login and signup pages store `noviq_token` / `noviq_user` in
   localStorage and redirect to /account — but nothing ever READ that
   state back. The account page is a server component (it cannot touch
   localStorage at all) and the navbar hard-links to /login, so a signed-in
   visitor kept seeing "Sign in to access…" and a Login button that went
   nowhere useful. The session existed; the display never knew.

   This provider is the one reader. It validates the stored token against
   GET /api/portal/me (which 401s on expired/revoked/deleted accounts),
   clears a dead token so the UI can never show a ghost session, and
   re-syncs across tabs via the `storage` event.

   SSR contract: the first render — server AND client — is always the
   logged-out state. The token is only read inside an effect, so there is
   no hydration mismatch and no layout shift: the navbar's login slot
   renders the identical Login link until the session resolves.
   ============================================================ */
'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '@/lib/api-client';

export const TOKEN_KEY = 'noviq_token';
export const USER_KEY = 'noviq_user';

export interface SessionUser {
  id: number | string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role?: string;
}

export interface SessionCounts {
  projects: number;
  contracts: number;
}

interface AuthValue {
  /** The signed-in user, or null when logged out / session dead. */
  user: SessionUser | null;
  /** Unread notifications for the bell badge. 0 when logged out. */
  unread: number;
  /** Project / contract counts for the dashboard. */
  counts: SessionCounts;
  /** True until the first session check finishes. Render the logged-out
   *  markup while true — never a spinner in the navbar slot. */
  loading: boolean;
  isLoggedIn: boolean;
  /** Re-run the session check (call after login/signup redirect lands). */
  refresh: () => Promise<void>;
  /** Clear the session. Client tokens are stateless (no server revoke). */
  logout: () => void;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  unread: 0,
  counts: { projects: 0, contracts: 0 },
  loading: true,
  isLoggedIn: false,
  refresh: async () => {},
  logout: () => {},
});

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearStoredSession() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* private mode / storage disabled — nothing to clear */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [unread, setUnread] = useState(0);
  const [counts, setCounts] = useState<SessionCounts>({ projects: 0, contracts: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = readStoredToken();
    if (!token) {
      setUser(null);
      setUnread(0);
      setCounts({ projects: 0, contracts: 0 });
      setLoading(false);
      return;
    }
    try {
      /* The single validation point: 401 here means expired, revoked, or
         deleted — clear it so a dead token can never render a session. */
      const me = await api.portal.me();
      const u = (me.user || {}) as Record<string, unknown>;
      setUser({
        id: (u.id as number | string) ?? '',
        firstName: typeof u.firstName === 'string' ? u.firstName : undefined,
        lastName: typeof u.lastName === 'string' ? u.lastName : undefined,
        email: typeof u.email === 'string' ? u.email : undefined,
        phone: typeof u.phone === 'string' ? u.phone : undefined,
        avatar: typeof u.avatar === 'string' ? u.avatar : undefined,
        role: typeof u.role === 'string' ? u.role : undefined,
      });
      setUnread(typeof me.unread === 'number' ? me.unread : 0);
      setCounts({
        projects: Number(me.counts?.projects) || 0,
        contracts: Number(me.counts?.contracts) || 0,
      });
    } catch {
      clearStoredSession();
      setUser(null);
      setUnread(0);
      setCounts({ projects: 0, contracts: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    /* Cross-tab sync: logging out in one tab updates every other tab. */
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === TOKEN_KEY || e.key === USER_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
    setUnread(0);
    setCounts({ projects: 0, contracts: 0 });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, unread, counts, loading, isLoggedIn: user !== null, refresh, logout }),
    [user, unread, counts, loading, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}

export default AuthProvider;
