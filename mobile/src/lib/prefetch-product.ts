import type { QueryClient } from "@tanstack/react-query";
import { getProductById, type ProductItem } from "../services/products";
import { rememberProductSeed } from "./product-seed";

/** Must match the queryKey/staleTime used by the product detail screen. */
export const PRODUCT_QUERY_STALE_TIME_MS = 10 * 60 * 1000;

type ProductLike = Partial<ProductItem> & { id?: string | null };

/**
 * Warm the product detail cache the moment a card is tapped.
 *
 * Two things happen here, and they matter in different ways:
 *
 * 1. The fetch starts at tap time rather than after the new screen has mounted,
 *    so the request overlaps the navigation animation. Because the key and
 *    staleTime match the detail screen's own query, that screen reuses the
 *    in-flight request instead of issuing a second one.
 *
 * 2. When the caller has the list record — and it almost always does, since it
 *    just rendered a card from it — that record is kept as a seed. The detail
 *    screen paints from it immediately, which is what removes the skeleton
 *    entirely on the common path. Passing a bare id still works; the screen
 *    simply falls back to its skeleton.
 *
 * Fire-and-forget by design: a failed prefetch must never block navigation —
 * the screen's own query will surface the error.
 */
export function prefetchProduct(
  queryClient: QueryClient,
  product: string | ProductLike | null | undefined
): void {
  const id = typeof product === "string" ? product : product?.id;
  if (!id) return;

  if (typeof product !== "string" && product) {
    rememberProductSeed(product);
  }

  void queryClient
    .prefetchQuery({
      queryKey: ["product", id],
      queryFn: ({ signal }: { signal?: AbortSignal }) => getProductById(id, signal),
      staleTime: PRODUCT_QUERY_STALE_TIME_MS,
    })
    .catch(() => undefined);
}
