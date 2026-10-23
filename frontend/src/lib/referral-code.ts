/**
 * Referral code from a ?ref= link, remembered on this device so it still applies
 * if the friend browses first and signs up (or checks out as a guest) later.
 */

const KEY = "ktmona.ref";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function rememberReferralCode(code: string | null | undefined) {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(c)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ code: c, at: Date.now() }));
  } catch {
    // Storage blocked: the code just won't be remembered.
  }
}

export function readReferralCode(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    return Date.now() - at < MAX_AGE_MS ? code : null;
  } catch {
    return null;
  }
}

export function forgetReferralCode() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
