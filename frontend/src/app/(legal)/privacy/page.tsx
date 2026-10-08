import { LegalPageLayout } from "@/components/legal-page-layout";
import { PolicyDocumentView } from "@/components/policy-document";
import { privacyPolicy } from "@/lib/legal-policies";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | KTMONA",
  description: "Privacy policy for how KTMONA collects, uses, and protects personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title={privacyPolicy.title}
      lastUpdated={privacyPolicy.lastUpdated}
      sections={privacyPolicy.sections.map((section) => ({ id: section.id, title: section.title }))}
    >
      <PolicyDocumentView policy={privacyPolicy} />
    </LegalPageLayout>
  );
}
