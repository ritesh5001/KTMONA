import { LegalPageLayout } from "@/components/legal-page-layout";
import { PolicyDocumentView } from "@/components/policy-document";
import { refundPolicy } from "@/lib/legal-policies";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy | KTMONA",
  description: "KTMONA refund policy.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      title={refundPolicy.title}
      lastUpdated={refundPolicy.lastUpdated}
      sections={refundPolicy.sections.map((section) => ({ id: section.id, title: section.title }))}
    >
      <PolicyDocumentView policy={refundPolicy} />
    </LegalPageLayout>
  );
}
