"use client";

import { useEffect } from "react";
import { currentPortal, getSessionRole, portalForRole } from "@/lib/session";
import { clearAuthSession } from "@/services/auth";

/**
 * Client-side session guard.
 *
 * Each portal (storefront, seller, admin) keeps its own session, so a role
 * from another portal can never appear here in normal use. If the current
 * portal's cookies somehow hold a role that does not belong to it, only THIS
 * portal's session is dropped — the other portals stay signed in.
 */
export function useSessionGuard() {
  useEffect(() => {
    const portal = currentPortal();
    const role = getSessionRole(portal);
    if (role && portalForRole(role) !== portal) {
      clearAuthSession();
    }
  }, []);
}
