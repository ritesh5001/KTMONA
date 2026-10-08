import * as React from "react";
import { LegalScreen } from "../../src/components/LegalScreen";
import { privacyPolicy } from "../../src/data/legal-policies";

export default function PrivacyPolicyScreen() {
  return (
    <LegalScreen
      title={privacyPolicy.title}
      intro={privacyPolicy.intro}
      updatedAt={privacyPolicy.updatedAt}
      sections={privacyPolicy.sections}
    />
  );
}
