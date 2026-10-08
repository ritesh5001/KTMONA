"use client";

import { useSessionGuard } from "@/hooks/use-session-guard";

/**
 * Invisible client component that runs the session guard on every page load.
 * Drop into root layout to enforce role–subdomain lock client-side.
 */
export function SessionGuard() {
  useSessionGuard();
  return null;
}
