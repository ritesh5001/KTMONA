import * as React from "react";
import { LegalScreen } from "../../src/components/LegalScreen";
import { termsPolicy } from "../../src/data/legal-policies";

export default function TermsScreen() {
  return (
    <LegalScreen
      title={termsPolicy.title}
      intro={termsPolicy.intro}
      updatedAt={termsPolicy.updatedAt}
      sections={termsPolicy.sections}
    />
  );
}
