import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { COMPANY_ADDRESS, ONBOARDING_EMAIL, REFUND_EMAIL, SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from "@/lib/site-config";

const policyLinks = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Return & Refund Policy", href: "/return-policy" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Vendor Agreement", href: "/vendor-agreement" },
  { label: "Disclaimer", href: "/disclaimer" },
];

const quickLinks = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Shop", href: "/marketplace" },
  { label: "Become a Seller", href: "/register/seller" },
  { label: "Contact Support", href: "/contact" },
  { label: "My Account", href: "/login" },
];

// Collections links — temporarily hidden, will be unhidden later
// const collections = [
//   { label: "New Arrivals", href: "/marketplace" },
//   { label: "Bestsellers", href: "/marketplace" },
//   { label: "Festive Edit", href: "/marketplace" },
// ];

const accordionSections = [
  { title: "Legal", links: policyLinks },
  { title: "Quick Links", links: quickLinks },
  // { title: "Collections", links: collections }, // temporarily hidden, will be unhidden later
];

export function PublicFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border-soft bg-mist text-foreground font-sans dark:bg-ink">
      <div className="mx-auto w-full max-w-6xl px-6 pt-14">
        <div className="grid gap-6 pb-10 md:gap-8 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="min-w-0 pr-0 lg:pr-6">
            <Link href="/" prefetch={false} className="inline-block transition-transform duration-300 hover:-translate-y-1">
              <BrandLogo className="mb-5 h-10" />
            </Link>
            <p className="max-w-xl border-l-[3px] border-brand pl-4 text-[15px] italic leading-7 text-muted-foreground max-sm:border-l-0 max-sm:border-t-2 max-sm:border-brand max-sm:pl-0 max-sm:pt-3">
              &ldquo;Trust Every Click.&rdquo; KTMONA (Knowledge, Trust &amp; More Online Network Access) is a multi-vendor marketplace where independent sellers across India reach customers they can serve with confidence.
            </p>
            <div className="mt-5 space-y-1 text-sm text-foreground/90">
              <p><span className="font-semibold">Head Office:</span> {COMPANY_ADDRESS}</p>
              <p><span className="font-semibold">Phone:</span> {SUPPORT_PHONE_DISPLAY}</p>
              <p><span className="font-semibold">Support:</span> <a className="text-brand-strong hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
              {ONBOARDING_EMAIL !== SUPPORT_EMAIL && (
                <p><span className="font-semibold">Onboarding:</span> <a className="text-brand-strong hover:underline" href={`mailto:${ONBOARDING_EMAIL}`}>{ONBOARDING_EMAIL}</a></p>
              )}
              {REFUND_EMAIL !== SUPPORT_EMAIL && (
                <p><span className="font-semibold">Refunds:</span> <a className="text-brand-strong hover:underline" href={`mailto:${REFUND_EMAIL}`}>{REFUND_EMAIL}</a></p>
              )}
            </div>
          </div>

          {accordionSections.map((section) => (
            <div key={section.title} className="min-w-0">
              <details className="md:hidden border-b border-border-soft group">
                <summary className="flex cursor-pointer list-none items-center justify-between px-2 py-3 text-left text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
                  <span>{section.title}</span>
                  <span className="text-brand-strong transition-transform duration-300 group-open:rotate-180">▾</span>
                </summary>
                <ul className="space-y-3 px-4 pb-4 text-sm font-medium tracking-[0.05em] text-foreground">
                  {section.links.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        className="group flex items-center gap-2 transition-all duration-300 hover:translate-x-1 hover:text-brand-strong"
                      >
                        <span className="-ml-1 inline-block text-brand-strong opacity-70 transition-opacity duration-300 group-hover:opacity-100">
                          ›
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>

              <div className="hidden md:block group max-sm:text-center">
                <h3 className="mb-6 inline-block text-lg font-semibold uppercase tracking-[0.08em] text-foreground after:mt-2 after:block after:h-0.5 after:w-10 group-hover:after:w-full after:bg-brand after:shadow-[0_2px_0_var(--color-navy)] after:transition-all after:duration-300">
                  {section.title}
                </h3>
                <ul className="space-y-2.5">
                  {section.links.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        className="group inline-flex items-center gap-2 text-sm font-medium tracking-[0.03em] text-foreground transition-all duration-300 hover:translate-x-1 hover:text-brand-strong"
                      >
                        <span className="-ml-1 inline-block text-brand-strong opacity-70 transition-opacity duration-300 group-hover:opacity-100">›</span>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-ink py-5 text-paper dark:bg-[#050C20]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-5 px-6 max-sm:flex-col-reverse max-sm:text-center">
          <p className="text-xs tracking-wide text-paper/80">
            © {new Date().getFullYear()} KTMONA. Trust Every Click. Crafted by NextGen Fusion.
          </p>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-brand">
            <span>Secure Payments</span>
            <span className="text-brand/40">•</span>
            <span>Trusted Checkout</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
