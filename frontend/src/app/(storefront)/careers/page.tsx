import type { Metadata } from "next";
import { CareersBoard } from "@/components/careers/CareersBoard";
import { BRAND_TAGLINE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Careers | KTMONA",
  description: "Join the KTMONA team and help independent sellers across India reach customers they can serve with confidence.",
};

export default function CareersPage() {
  return (
    <div className="bg-background">
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand">Careers at KTMONA</p>
          <h1 className="mt-4 font-serif text-4xl font-light sm:text-5xl">Build the marketplace India can trust.</h1>
          <p className="mt-4 max-w-2xl text-paper/80">
            &ldquo;{BRAND_TAGLINE}.&rdquo; We help small businesses and home sellers sell online with confidence. If you care about
            sellers, shoppers and getting the details right, we&apos;d love to hear from you.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-4 text-xl font-semibold">Open positions</h2>
        <CareersBoard source="customer" />
      </section>
    </div>
  );
}
