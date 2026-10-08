import { LegalPageLayout } from "@/components/legal-page-layout";
import { PolicyDocumentView } from "@/components/policy-document";
import { termsPolicy } from "@/lib/legal-policies";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | KTMONA",
  description: "Terms and conditions for using the KTMONA marketplace.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title={termsPolicy.title}
      lastUpdated={termsPolicy.lastUpdated}
      sections={termsPolicy.sections.map((section) => ({ id: section.id, title: section.title }))}
    >
      <PolicyDocumentView policy={termsPolicy} />
    </LegalPageLayout>
  );
}
