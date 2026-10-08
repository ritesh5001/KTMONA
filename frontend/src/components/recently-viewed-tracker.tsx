"use client";

import { useEffect } from "react";
import { apiRequest } from "@/services/api";

/**
 * Fire-and-forget client component that tracks a product view
 * for the authenticated user. Renders nothing visible.
 */
export function RecentlyViewedTracker({ productId }: { productId: string }) {
  useEffect(() => {
    if (!productId) return;

    // Fire-and-forget — we intentionally don't await or show loading
    apiRequest(`/v1/personalization/recently-viewed/${productId}`, {
      method: "POST",
    }).catch(() => {
      // Silently ignore — user may not be logged in
    });
  }, [productId]);

  return null;
}
