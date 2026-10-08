import { Suspense } from "react";
import SellerOrdersClient from "./page.client";

export default function SellerOrdersPage() {
  return (
    <Suspense fallback={null}>
      <SellerOrdersClient />
    </Suspense>
  );
}
