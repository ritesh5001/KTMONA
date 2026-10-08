import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type AuthUser = {
  id: string;
  fullName?: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  /**
   * Profile picture URL, or null when the user has none and we fall back to
   * their initial. Not returned by the login endpoints — it is hydrated from
   * /v1/me shortly after sign-in and refreshed whenever the user changes it.
   */
  avatar?: string | null;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

const AUTH_STORAGE_KEY = "ktmona.auth";
let cachedSession: AuthSession | null | undefined;

async function getStoredAuthValue(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(AUTH_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  return SecureStore.getItemAsync(AUTH_STORAGE_KEY);
}

async function setStoredAuthValue(value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(AUTH_STORAGE_KEY, value);
    } catch {}
    return;
  }

  await SecureStore.setItemAsync(AUTH_STORAGE_KEY, value);
}

async function deleteStoredAuthValue(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.removeItem(AUTH_STORAGE_KEY);
    } catch {}
    return;
  }

  await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
}

export async function loadSession(): Promise<AuthSession | null> {
  if (cachedSession !== undefined) {
    return cachedSession;
  }

  const stored = await getStoredAuthValue();
  if (!stored) {
    cachedSession = null;
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as AuthSession;
    cachedSession = parsed;
    return parsed;
  } catch {
    cachedSession = null;
    return null;
  }
}

export async function saveSession(session: AuthSession): Promise<void> {
  cachedSession = session;
  await setStoredAuthValue(JSON.stringify(session));
}

/** Update only access + refresh tokens inside the stored session. */
export async function updateTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const session = await loadSession();
  if (!session) return;
  const updated: AuthSession = { ...session, accessToken, refreshToken };
  await saveSession(updated);
}

export async function clearSession(): Promise<void> {
  cachedSession = null;
  await deleteStoredAuthValue();
}

export async function getAccessToken(): Promise<string | null> {
  const session = await loadSession();
  return session?.accessToken ?? null;
}
