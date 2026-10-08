import SellerProductsClient from "../manage/page.client";
import { loadEditorData } from "../manage/load";

export default async function SellerAddProductPage() {
  const initialData = await loadEditorData();
  return <SellerProductsClient initialData={initialData} initialMode="create" />;
}
