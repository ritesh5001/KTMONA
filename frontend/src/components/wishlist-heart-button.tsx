"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleWishlistItem, checkWishlistItems } from "@/services/wishlist";
import { startNavigationFeedback } from "@/lib/navigation-feedback";
import { loginUrlWithReturn } from "@/lib/login-redirect";
import { hasSession } from "@/lib/session";

interface WishlistHeartButtonProps {
  productId: string;
  /** Extra classes on the outer button */
  className?: string;
  /** Size of the heart icon (default 16) */
  size?: number;
}

/**
 * Client-component heart toggle for product cards.
 * Renders as an absolute-positioned overlay button by default.
 */
export function WishlistHeartButton({
  productId,
  className = "",
  size = 16,
}: WishlistHeartButtonProps) {
  const router = useRouter();
  const [wishlisted, setWishlisted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);


  React.useEffect(() => {
    let cancelled = false;
    if (!hasSession()) return;
    checkWishlistItems([productId])
      .then((res) => {
        if (!cancelled) setWishlisted(res.wishlisted.includes(productId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault(); // prevents navigation on card Link
    e.stopPropagation();

    if (!hasSession()) {
      toast.error("Please sign in to save items.");
      startNavigationFeedback();
      router.push(loginUrlWithReturn());
      return;
    }

    setBusy(true);
    const prev = wishlisted;
    setWishlisted(!prev);
    try {
      const result = await toggleWishlistItem(productId);
      setWishlisted(result.added);
    } catch {
      setWishlisted(prev);
      toast.error("Unable to update wishlist");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`inline-flex items-center justify-center transition-all duration-300 disabled:opacity-50 ${className}`}
      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={wishlisted ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.5}
        width={size}
        height={size}
        className={`transition-colors duration-300 ${
          wishlisted ? "text-red-500" : "text-current"
        }`}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  );
}
