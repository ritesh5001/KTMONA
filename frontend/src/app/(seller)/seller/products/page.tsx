import { cookies } from "next/headers";
import SellerProductsClient, {
  type SellerProductsInitialData,
} from "./page.client";
import { getCategories } from "@/services/catalog";
import { getOccasions } from "@/services/occasions";
import { listSellerProducts } from "@/services/seller-products";

export default async function SellerProductsPage() {
  const token = (await cookies()).get("ktmona_access")?.value ?? null;

  const [categoriesResult, productsResult, occasionsResult] =
    await Promise.allSettled([
      getCategories(),
      listSellerProducts(token),
      getOccasions(),
    ]);

  const initialData: SellerProductsInitialData = {
    categories:
      categoriesResult.status === "fulfilled"
        ? categoriesResult.value.categories ?? []
        : [],
    products:
      productsResult.status === "fulfilled"
        ? productsResult.value.products ?? []
        : [],
    occasions:
      occasionsResult.status === "fulfilled"
        ? occasionsResult.value.occasions ?? []
        : [],
  };

  return <SellerProductsClient initialData={initialData} />;
}
