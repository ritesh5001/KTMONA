"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getWishlist,
  removeWishlistItem,
  type WishlistItemDetail,
} from "@/services/wishlist";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function UserWishlistPage() {
  const [items, setItems] = React.useState<WishlistItemDetail[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getWishlist()
      .then((res) => {
        if (!cancelled) setItems(res.wishlist.items);
      })
      .catch(() => {
        if (!cancelled) toast.error("Unable to load wishlist");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.productId !== productId));
    try {
      await removeWishlistItem(productId);
      toast.success("Removed from wishlist");
    } catch {
      setItems(prev);
      toast.error("Unable to remove item");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="min-h-[50vh]">
      <div className="flex w-full flex-col gap-8">
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-brand-strong">
            My Account
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Wishlist
          </h1>
          <p className="text-sm text-muted-foreground">
            Your saved items — curated finds, waiting for the perfect moment.
          </p>
        </div>

        {/* Separator */}
        <div className="h-px bg-border-soft" />

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-20 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              className="h-16 w-16 text-muted-foreground/40"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            <p className="text-sm text-muted-foreground">
              Your wishlist is empty. Explore our collections and save items you love.
            </p>
            <Link href="/marketplace">
              <Button size="md" variant="primary">
                Explore Marketplace
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="group relative border border-border-soft bg-card transition-all duration-300 hover:border-brand/30"
              >
                {/* Image */}
                <Link
                  href={`/product/${item.productId}`}
                  className="relative block aspect-3/4 overflow-hidden bg-mist dark:bg-navy/20"
                >
                  <Image
                    src={
                      item.product.images?.[0] ??
                      "/images/product-placeholder.svg"
                    }
                    alt={item.product.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-contain p-4 transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                </Link>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemove(item.productId)}
                  disabled={removingId === item.productId}
                  className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center bg-card/90 backdrop-blur-sm border border-border-soft text-red-500 transition-all duration-300 hover:bg-red-50 hover:border-red-200 disabled:opacity-50"
                  aria-label="Remove from wishlist"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>

                {/* Info */}
                <div className="space-y-2 p-5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {item.product.category?.name ?? "Collection"}
                  </p>
                  <Link
                    href={`/product/${item.productId}`}
                    className="block font-serif text-lg font-normal text-foreground transition-colors duration-300 hover:text-brand-strong"
                  >
                    {item.product.title}
                  </Link>
                  {typeof item.product.adminListingPrice === "number" ? (
                    <p className="text-sm font-medium text-foreground">
                      {currency.format(item.product.adminListingPrice)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Price on request
                    </p>
                  )}
                  <Link
                    href={`/product/${item.productId}`}
                    className="mt-3 inline-flex h-10 items-center justify-center border border-border-soft px-6 text-[10px] font-medium uppercase tracking-[0.15em] text-foreground transition-all duration-300 hover:bg-mist dark:hover:bg-navy/30"
                  >
                    View Product
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
