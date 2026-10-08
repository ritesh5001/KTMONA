"use client";

import { useEffect } from "react";
import {
  getSubdomain,
  isRoleAllowedOnSubdomain,
  isLocalhost,
  getCorrectLoginUrl,
} from "@/lib/subdomain";
import { clearAuthSession } from "@/services/auth";

/**
 * Client-side session guard.
 * On every page load, checks that the role cookie matches the current subdomain.
 * If mismatched (and not on localhost), clears auth cookies and redirects to
 * the correct login page. Skips if already on a login/auth page to prevent loops.
 */
export function useSessionGuard() {
  useEffect(() => {
    if (isLocalhost()) return;

    const subdomain = getSubdomain();

    // Read role cookie
    const match = document.cookie.match(/(?:^|; )ktmona_role=([^;]*)/);
    const role = match ? decodeURIComponent(match[1]).toUpperCase() : null;

    if (!role) return; // Not logged in — nothing to guard

    if (!isRoleAllowedOnSubdomain(role, subdomain)) {
      // Avoid redirect loops on auth pages
      if (window.location.pathname === "/login" || window.location.pathname.startsWith("/register")) {
        return;
      }

      clearAuthSession();
      const correctLogin = getCorrectLoginUrl(role);
      window.location.assign(correctLogin);
    }
  }, []);
}
