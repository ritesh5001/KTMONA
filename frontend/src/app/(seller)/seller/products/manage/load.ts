import { cookies } from "next/headers";
import type { SellerProductsInitialData } from "./page.client";
import { getCategories } from "@/services/catalog";
import { getOccasions } from "@/services/occasions";
import { listSellerProducts } from "@/services/seller-products";

/** Server-side data for the product editor (categories, products, occasions). */
export async function loadEditorData(): Promise<SellerProductsInitialData> {
  const token = (await cookies()).get("ktmona_access")?.value ?? null;
  const [categoriesResult, productsResult, occasionsResult] = await Promise.allSettled([
    getCategories(),
    listSellerProducts(token),
    getOccasions(),
  ]);
  return {
    categories: categoriesResult.status === "fulfilled" ? categoriesResult.value.categories ?? [] : [],
    products: productsResult.status === "fulfilled" ? productsResult.value.products ?? [] : [],
    occasions: occasionsResult.status === "fulfilled" ? occasionsResult.value.occasions ?? [] : [],
  };
}
