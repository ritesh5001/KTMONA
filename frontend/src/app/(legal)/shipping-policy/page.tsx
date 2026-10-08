import { LegalPageLayout } from "@/components/legal-page-layout";
import { PolicyDocumentView } from "@/components/policy-document";
import { shippingPolicy } from "@/lib/legal-policies";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | KTMONA",
  description: "Shipping timelines, charges, tracking, and delivery terms for KTMONA orders.",
};

export default function ShippingPolicyPage() {
  return (
    <LegalPageLayout
      title={shippingPolicy.title}
      lastUpdated={shippingPolicy.lastUpdated}
      sections={shippingPolicy.sections.map((section) => ({ id: section.id, title: section.title }))}
    >
      <PolicyDocumentView policy={shippingPolicy} />
    </LegalPageLayout>
  );
}
