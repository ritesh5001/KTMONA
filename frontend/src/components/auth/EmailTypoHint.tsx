"use client";

import * as React from "react";
import { suggestEmailFix } from "@/lib/email-typo";

/**
 * "Did you mean …@gmail.com?" under an email field. The OTP goes to this
 * address, so a typo means the code never arrives.
 */
export function EmailTypoHint({ email, onFix }: { email: string; onFix: (fixed: string) => void }) {
  const suggestion = suggestEmailFix(email);
  if (!suggestion) return null;
  return (
    <p className="text-xs text-amber-700 dark:text-amber-400">
      Did you mean{" "}
      <button type="button" className="font-semibold underline underline-offset-2" onClick={() => onFix(suggestion)}>
        {suggestion}
      </button>
      ? We&apos;ll send your OTP to this email, so please check it carefully.
    </p>
  );
}

/**
 * Stops the first submit when the email looks misspelt; submitting the same
 * address again goes through (some unusual domains are real).
 */
export function useEmailTypoGuard() {
  const confirmed = React.useRef<string | null>(null);
  return React.useCallback((email: string): string | null => {
    const value = email.trim().toLowerCase();
    const suggestion = suggestEmailFix(value);
    if (!suggestion || confirmed.current === value) return null;
    confirmed.current = value;
    return `Did you mean ${suggestion}? Fix the email, or submit again to keep ${value}.`;
  }, []);
}
