import * as React from "react";
import {
  loadSession,
  saveSession,
  clearSession,
  type AuthSession,
  type AuthUser,
} from "../storage/auth";
import { getMyProfile } from "../services/profile";
import {
  loginUser,
  logoutUser,
  verifyOtp,
  isLoginResponse,
  ALLOWED_ROLE,
  type LoginPayload,
  type VerifyOtpPayload,
  type LoginResponse,
} from "../services/auth";
import {
  setSessionExpiredHandler,
  clearInFlightRequests,
  resetRefreshMutex,
} from "../services/api";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

type AuthContextValue = {
  session: AuthSession | null;
  isLoading: boolean;
  /** True when a refresh attempt failed mid-session → shows modal */
  sessionExpired: boolean;
  /** Dismiss the session-expired modal (navigate to login yourself) */
  acknowledgeSessionExpired: () => void;
  /** Password-based sign-in */
  signIn: (payload: LoginPayload) => Promise<void>;
  /** OTP-based sign-in — returns a message string when login is not immediate */
  signInWithOtp: (payload: VerifyOtpPayload) => Promise<string | null>;
  /** Hard sign-out: server revoke + clear storage + reset in-flight state */
  signOut: () => Promise<void>;
  /**
   * Merge fields into the cached user and persist them.
   *
   * The login endpoints do not carry every profile field — the avatar, for one,
   * is fetched separately — so the session needs a way to take on new values
   * without a full re-authentication.
   */
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
};

export const AuthContext = React.createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Role-guard helper
// ---------------------------------------------------------------------------

function assertBuyerRole(user: { role: string }): void {
  if (user.role !== ALLOWED_ROLE) {
    throw new RoleError(
      `This app is for buyers only. Accounts with role "${user.role}" cannot sign in here.`
    );
  }
}

class RoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleError";
  }
}

// ---------------------------------------------------------------------------
// Shared helper: persist a LoginResponse into state
// ---------------------------------------------------------------------------

function buildSession(res: LoginResponse): AuthSession {
  return {
    user: res.user,
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [sessionExpired, setSessionExpired] = React.useState(false);

  // ------- Hydrate session on cold start (auto-login) -------
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadSession();
        if (!stored) return;

        // Role-check the cached user — in case the role changed server-side
        // while the app was closed. We don't block; we just clear.
        if (stored.user.role !== ALLOWED_ROLE) {
          await clearSession();
          return;
        }

        if (!cancelled) setSession(stored);
      } catch {
        // corrupt storage → start fresh
        await clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateUser = React.useCallback(async (patch: Partial<AuthUser>) => {
    let next: AuthSession | null = null;
    setSession((current) => {
      if (!current) return current;
      next = { ...current, user: { ...current.user, ...patch } };
      return next;
    });
    // Persist outside the updater so storage is never written from inside a
    // render-phase callback.
    if (next) await saveSession(next);
  }, []);

  // ------- Hydrate profile fields the login response does not carry -------
  //
  // The avatar lives on user_profiles, which the auth endpoints do not join.
  // Fetching it once per session keeps sign-in fast and still means the picture
  // is there by the time the shopper opens the menu or their profile.
  React.useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || session?.user?.avatar !== undefined) return;

    const controller = new AbortController();
    getMyProfile(controller.signal)
      .then((profile) => {
        void updateUser({ avatar: profile.avatar });
      })
      .catch(() => {
        // Non-fatal: the initial is a perfectly good fallback. Mark it resolved
        // so this does not retry on every render.
        void updateUser({ avatar: null });
      });

    return () => controller.abort();
  }, [session?.user?.id, session?.user?.avatar, updateUser]);

  // ------- Session-expired callback from API layer -------
  React.useEffect(() => {
    setSessionExpiredHandler(() => {
      // The API layer has already wiped storage before notifying us. Only reset
      // request bookkeeping here so there is no duplicate, unhandled deletion.
      clearInFlightRequests();
      resetRefreshMutex();
      setSession(null);
      setSessionExpired(true);
    });
    return () => setSessionExpiredHandler(() => {});
  }, []);

  const acknowledgeSessionExpired = React.useCallback(() => {
    setSessionExpired(false);
  }, []);

  // ------- Hard logout -------
  const signOut = React.useCallback(async () => {
    // 1. Abort in-flight requests so nothing writes back after signOut
    clearInFlightRequests();
    resetRefreshMutex();

    // 2. Server-side revoke (best-effort)
    const cur = await loadSession();
    if (cur?.refreshToken && cur.accessToken) {
      await logoutUser(cur.refreshToken, cur.accessToken);
    }

    // 3. Nuke local storage
    await clearSession();

    // 4. State reset
    setSession(null);
    setSessionExpired(false);
  }, []);

  // ------- Password sign-in -------
  const signIn = React.useCallback(async (payload: LoginPayload) => {
    const result = await loginUser(payload);

    // Buyer-only gate
    assertBuyerRole(result.user);

    const next = buildSession(result);
    await saveSession(next);
    setSession(next);
  }, []);

  // ------- OTP sign-in -------
  const signInWithOtp = React.useCallback(
    async (payload: VerifyOtpPayload): Promise<string | null> => {
      const result = await verifyOtp(payload);

      if (!isLoginResponse(result)) {
        // Server returned a message (e.g. "Seller approval pending")
        return result.message;
      }

      // Buyer-only gate
      assertBuyerRole(result.user);

      const next = buildSession(result);
      await saveSession(next);
      setSession(next);
      return null; // null = success, user is logged in
    },
    []
  );

  // ------- Context value (stable via useMemo) -------
  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      sessionExpired,
      acknowledgeSessionExpired,
      signIn,
      signInWithOtp,
      signOut,
      updateUser,
    }),
    [
      session,
      isLoading,
      sessionExpired,
      acknowledgeSessionExpired,
      signIn,
      signInWithOtp,
      signOut,
      updateUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
