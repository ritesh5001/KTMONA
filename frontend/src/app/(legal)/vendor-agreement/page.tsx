import { LegalPageLayout } from "@/components/legal-page-layout";
import { PolicyDocumentView } from "@/components/policy-document";
import { vendorAgreementPolicy } from "@/lib/legal-policies";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendor Agreement | KTMONA",
  description: "Vendor agreement summary for KTMONA sellers.",
};

export default function VendorAgreementPage() {
  return (
    <LegalPageLayout
      title={vendorAgreementPolicy.title}
      lastUpdated={vendorAgreementPolicy.lastUpdated}
      sections={vendorAgreementPolicy.sections.map((section) => ({ id: section.id, title: section.title }))}
    >
      <PolicyDocumentView policy={vendorAgreementPolicy} />
    </LegalPageLayout>
  );
}
