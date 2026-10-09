import { Suspense } from "react";
import { HelpCenter } from "@/components/seller/HelpCenter";

export const metadata = {
  title: "Support | KTMONA Seller",
  description: "Find answers, raise a ticket or claim, and chat with the KTMONA team about listings, orders and payments.",
};

export default function SellerSupportPage() {
  return (
    <Suspense fallback={null}>
      <HelpCenter />
    </Suspense>
  );
}
