/**
 * Catches misspelt email domains ("gmaiil.com", "gmial.com", "yaho.com") before
 * an OTP is sent there. Such domains often accept the mail, so Resend reports it
 * as delivered while the person never receives the code.
 */
const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.in",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "rediffmail.com",
  "protonmail.com",
  "zoho.com",
  "aol.com",
];

/** Real providers close in spelling to the list above; never "correct" these. */
const ALSO_VALID = ["gmx.com", "gmx.net", "ymail.com", "mail.com", "me.com", "mac.com", "msn.com", "hotmail.co.uk", "outlook.in", "live.in"];

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
      // Swapped neighbours ("gmial") count as one edit.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i]![j] = Math.min(dp[i]![j]!, dp[i - 2]![j - 2]! + 1);
      }
    }
  }
  return dp[a.length]![b.length]!;
}

/** The corrected address when the domain looks like a typo of a common one, else null. */
export function suggestEmailFix(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!domain || COMMON_DOMAINS.includes(domain) || ALSO_VALID.includes(domain)) return null;
  let best: { domain: string; d: number } | null = null;
  for (const known of COMMON_DOMAINS) {
    const d = distance(domain, known);
    if (d > 0 && d <= 2 && (!best || d < best.d)) best = { domain: known, d };
  }
  return best ? `${local}@${best.domain}` : null;
}
