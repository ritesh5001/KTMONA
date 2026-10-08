import * as React from "react";
import { LegalScreen } from "../../src/components/LegalScreen";
import { shippingPolicy } from "../../src/data/legal-policies";

export default function ShippingPolicyScreen() {
  return (
    <LegalScreen
      title={shippingPolicy.title}
      intro={shippingPolicy.intro}
      updatedAt={shippingPolicy.updatedAt}
      sections={shippingPolicy.sections}
    />
  );
}
