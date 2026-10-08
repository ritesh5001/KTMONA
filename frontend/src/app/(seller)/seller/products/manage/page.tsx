import SellerProductsClient from "./page.client";
import { loadEditorData } from "./load";

export default async function SellerProductEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ edit }, initialData] = await Promise.all([searchParams, loadEditorData()]);
  return <SellerProductsClient initialData={initialData} focusProductId={edit ?? null} />;
}
