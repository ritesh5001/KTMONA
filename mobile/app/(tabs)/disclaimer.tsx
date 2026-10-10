import * as React from "react";
import { LegalScreen } from "../../src/components/LegalScreen";
import { disclaimerPolicy } from "../../src/data/legal-policies";

export default function DisclaimerScreen() {
  return <LegalScreen title={disclaimerPolicy.title} intro={disclaimerPolicy.intro} updatedAt={disclaimerPolicy.updatedAt} sections={disclaimerPolicy.sections} />;
}
