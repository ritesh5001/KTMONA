import * as React from "react";
import { LegalScreen } from "../../src/components/LegalScreen";
import { companyInfo } from "../../src/data/company";

export default function ContactScreen() {
  return (
    <LegalScreen
      title="Support & Contact"
      intro="Our support and concierge desk helps with order updates, sizing guidance, return requests, and payment assistance."
      updatedAt="March 14, 2026"
      sections={[
        {
          title: "Customer Support",
          body: `Phone: ${companyInfo.supportPhoneDisplay}\nSupport: ${companyInfo.supportEmail}\nOnboarding: ${companyInfo.onboardingEmail}\nRefunds: ${companyInfo.refundEmail}\nHours: ${companyInfo.supportHours}`,
        },
        {
          title: "Styling Concierge",
          body: "Need help selecting a wedding look? Share event details and fit preferences, and our team will suggest curated options by occasion.",
        },
        {
          title: "Office",
          body: `${companyInfo.supportAddress}\nWebsite: ${companyInfo.website}`,
        },
      ]}
    />
  );
}
