import type { ProductDetail, ProductItem } from "../services/products";

/**
 * Last-known list-level record for a product, keyed by id.
 *
 * Every list already holds everything the detail screen shows above the fold —
 * title, images, category, description and price. Only `variants` is missing.
 * Keeping those records here lets the detail screen paint real content on its
 * first frame instead of a skeleton, so a tap feels like the page was already
 * there rather than like the start of a round trip.
 *
 * Deliberately a plain module-level map rather than a react-query entry: the
 * detail query key is shared with QuickBuySheet, which needs real variants, and
 * seeding that key with a variant-less product would make the sheet claim the
 * item has no sizes.
 */
const seeds = new Map<string, ProductItem>();

/** Bounded so a long browsing session cannot grow this without limit. */
const MAX_SEEDS = 300;

type SeedInput = Partial<ProductItem> & { id?: string | null };

export function rememberProductSeed(product: SeedInput | null | undefined): void {
  const id = product?.id;
  if (!id) return;

  // Re-inserting moves the key to the end of the iteration order, which is what
  // makes the eviction below least-recently-used rather than arbitrary.
  seeds.delete(id);
  seeds.set(id, product as ProductItem);

  if (seeds.size > MAX_SEEDS) {
    const oldest = seeds.keys().next();
    if (!oldest.done) seeds.delete(oldest.value);
  }
}

export function getProductSeed(id: string | null | undefined): ProductItem | undefined {
  if (!id) return undefined;
  return seeds.get(id);
}

/**
 * Shape a seed like a `ProductDetail` so the detail screen can render it
 * through exactly the same code path as a real response.
 *
 * A seed taken from a list has no variants; one recorded after a full detail
 * fetch does, and those are kept — revisiting a product the shopper already
 * opened should show its sizes straight away rather than re-blanking them while
 * the refresh runs.
 */
export function seedToProductDetail(seed: ProductItem): ProductDetail {
  const known = (seed as Partial<ProductDetail>).variants;
  return { ...seed, variants: Array.isArray(known) ? known : [] } as ProductDetail;
}
