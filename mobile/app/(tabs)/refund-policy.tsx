import * as React from "react";
import { LegalScreen } from "../../src/components/LegalScreen";
import { refundPolicy } from "../../src/data/legal-policies";

export default function RefundPolicyScreen() {
  return (
    <LegalScreen
      title={refundPolicy.title}
      intro={refundPolicy.intro}
      updatedAt={refundPolicy.updatedAt}
      sections={refundPolicy.sections}
    />
  );
}
