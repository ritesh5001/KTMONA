import * as React from "react";
import { LegalScreen } from "../../src/components/LegalScreen";
import { aboutPolicy } from "../../src/data/legal-policies";

export default function AboutScreen() {
  return <LegalScreen title={aboutPolicy.title} intro={aboutPolicy.intro} updatedAt={aboutPolicy.updatedAt} sections={aboutPolicy.sections} />;
}
