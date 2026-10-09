"use client";

import { CareersBoard } from "@/components/careers/CareersBoard";
import { PageHeader, PageShell } from "@/components/seller/kit";

export default function SellerCareersPage() {
  return (
    <PageShell>
      <PageHeader
        title="Careers at KTMONA"
        description="Open roles on the KTMONA team. Know someone who would be a great fit? Share this page with them."
      />
      <CareersBoard source="seller" />
    </PageShell>
  );
}
