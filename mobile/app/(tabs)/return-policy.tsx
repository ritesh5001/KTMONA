import * as React from "react";
import { LegalScreen } from "../../src/components/LegalScreen";
import { returnPolicy } from "../../src/data/legal-policies";

export default function ReturnPolicyScreen() {
  return (
    <LegalScreen
      title={returnPolicy.title}
      intro={returnPolicy.intro}
      updatedAt={returnPolicy.updatedAt}
      sections={returnPolicy.sections}
    />
  );
}
