import * as React from "react";
import { LegalScreen } from "../../src/components/LegalScreen";
import { vendorAgreementPolicy } from "../../src/data/legal-policies";

export default function VendorAgreementScreen() {
  return (
    <LegalScreen
      title={vendorAgreementPolicy.title}
      intro={vendorAgreementPolicy.intro}
      updatedAt={vendorAgreementPolicy.updatedAt}
      sections={vendorAgreementPolicy.sections}
    />
  );
}
