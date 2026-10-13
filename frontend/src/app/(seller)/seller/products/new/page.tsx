import SellerProductsClient from "../manage/page.client";
import { loadEditorData } from "../manage/load";
import { KycGate } from "@/components/seller/KycGate";

export default async function SellerAddProductPage() {
  const initialData = await loadEditorData();
  // Sellers can list products only after KTMONA verifies their KYC.
  return (
    <KycGate>
      <SellerProductsClient initialData={initialData} initialMode="create" />
    </KycGate>
  );
}
