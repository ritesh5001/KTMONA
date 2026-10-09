import { cookies } from "next/headers";
import { readPortalSession } from "@/lib/session";
import type { SellerProductsInitialData } from "./page.client";
import { getCategories } from "@/services/catalog";
import { getOccasions } from "@/services/occasions";
import { listSellerProducts } from "@/services/seller-products";

/** Server-side data for the product editor (categories, products, occasions). */
export async function loadEditorData(): Promise<SellerProductsInitialData> {
  const cookieStore = await cookies();
  const token =
    readPortalSession((name) => cookieStore.get(name)?.value, "seller").access ?? null;
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
