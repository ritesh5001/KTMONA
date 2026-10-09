import type { Metadata } from "next";
import { BadgeCheck, Lock, Store, Truck } from "lucide-react";
import { InvestorInquiryForm } from "@/components/investors/InvestorInquiryForm";
import { BRAND_FULL_FORM, COMPANY_ADDRESS, PARTNERSHIP_EMAIL, SUPPORT_PHONE_DISPLAY } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Investors | KTMONA",
  description: "Investor relations for KTMONA, the multi-vendor marketplace for verified independent sellers across India. Get in touch with our team.",
};

const PILLARS = [
  { icon: Store, title: "Multi-vendor marketplace", text: "Independent sellers, resellers and home businesses across India list their products on one platform." },
  { icon: BadgeCheck, title: "Verified at every step", text: "Every seller is approved by our team and every product passes catalog QC before it goes live." },
  { icon: Lock, title: "KTMONA Price Lock", text: "Sellers commit to their lowest market price, giving shoppers a clear reason to buy on KTMONA." },
  { icon: Truck, title: "End-to-end commerce", text: "Secure payments, tracked shipping, easy returns and seller payouts handled on the platform." },
];

export default function InvestorsPage() {
  return (
    <div className="bg-background">
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand">Investor Relations</p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl font-light sm:text-5xl">Invest in a marketplace built on trust.</h1>
          <p className="mt-4 max-w-2xl text-paper/80">
            KTMONA ({BRAND_FULL_FORM}) gives every seller in India a simple, transparent way to sell online, and every
            customer a marketplace they can trust with each click.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="text-xl font-semibold">What we are building</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {PILLARS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-border-soft bg-card p-5">
                <p.icon className="h-6 w-6 text-brand-strong" />
                <p className="mt-3 font-semibold">{p.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-xl font-semibold">Contact investor relations</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold">Email</dt><dd><a className="text-brand-strong hover:underline" href={`mailto:${PARTNERSHIP_EMAIL}`}>{PARTNERSHIP_EMAIL}</a></dd></div>
            <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold">Phone</dt><dd>{SUPPORT_PHONE_DISPLAY}</dd></div>
            <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold">Head office</dt><dd>{COMPANY_ADDRESS}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            Company documents, financial information and investment terms are shared directly with interested investors on request.
          </p>
        </div>

        <div className="rounded-2xl border border-border-soft bg-card p-6">
          <h2 className="text-lg font-semibold">Send an enquiry</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tell us about yourself and your interest. Our team will get back to you.</p>
          <InvestorInquiryForm />
        </div>
      </section>
    </div>
  );
}
