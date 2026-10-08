import { cookies } from "next/headers";
import AdminProductsClient, {
  type AdminProductsInitialData,
} from "./page.client";
import { getAllProducts } from "@/services/admin";
import { getCategories } from "@/services/catalog";
import { getOccasions } from "@/services/occasions";

export default async function AdminProductsPage() {
  const token = (await cookies()).get("ktmona_access")?.value ?? null;

  if (!token) {
    return <AdminProductsClient initialData={null} />;
  }

  const [productsResult, categoriesResult, occasionsResult] =
    await Promise.allSettled([
      getAllProducts(token),
      getCategories(),
      getOccasions(),
    ]);

  const initialData: AdminProductsInitialData = {
    products:
      productsResult.status === "fulfilled"
        ? productsResult.value.products ?? []
        : [],
    categories:
      categoriesResult.status === "fulfilled"
        ? categoriesResult.value.categories ?? []
        : [],
    occasions:
      occasionsResult.status === "fulfilled"
        ? occasionsResult.value.occasions ?? []
        : [],
  };

  return <AdminProductsClient initialData={initialData} />;
}
