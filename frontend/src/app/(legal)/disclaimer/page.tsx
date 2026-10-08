import { LegalPageLayout } from "@/components/legal-page-layout";
import { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
    title: "Disclaimer | KTMONA",
    description: "Legal disclaimer regarding product accuracy, vendor liability, third-party links, and limitation of damages for KTMONA.",
};

const SECTIONS = [
    { id: "general-information", title: "General Information" },
    { id: "product-accuracy", title: "Product Accuracy" },
    { id: "vendor-liability", title: "Vendor Liability" },
    { id: "third-party-links", title: "Third-Party Links" },
    { id: "limitation-of-damages", title: "Limitation of Damages" },
];

const SITE_HOST = (() => {
    try {
        return new URL(SITE_URL).host;
    } catch {
        return SITE_URL;
    }
})();

export default function DisclaimerPage() {
    return (
        <LegalPageLayout
            title="Disclaimer"
            lastUpdated="October 25, 2023"
            sections={SECTIONS}
        >
            <section id="general-information">
                <h2>General Information</h2>
                <p>
                    The information provided by KTMONA (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) on {SITE_HOST} (the &ldquo;Site&rdquo;) is for general informational purposes only. All information on the Site is provided in good faith, however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Site.
                </p>
            </section>

            <section id="product-accuracy">
                <h2>Product Accuracy</h2>
                <p>
                    KTMONA is a multi-vendor marketplace. While we strive to ensure that product images, descriptions, and specifications provided by our sellers are accurate, the actual color, texture, and fit of the garments may vary slightly from what is displayed on your monitor or screen. We do not warrant that product descriptions or other content are fully accurate, complete, reliable, current, or error-free.
                </p>
            </section>

            <section id="vendor-liability">
                <h2>Vendor Liability</h2>
                <p>
                    Products sold on this platform are listed and fulfilled by independent boutique owners, artisans, and sellers. KTMONA acts strictly as an intermediary marketplace facilitator.
                </p>
                <ul>
                    <li>We are not directly responsible for the manufacturing process, quality control, or safety standards of the items sold by third-party vendors.</li>
                    <li>Any claims, disputes, or liabilities arising from the purchase or use of a product rest entirely with the respective seller.</li>
                </ul>
            </section>

            <section id="third-party-links">
                <h2>Third-Party Links</h2>
                <p>
                    The Site may contain links to other websites or content belonging to or originating from third parties. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us. We do not warrant, endorse, guarantee, or assume responsibility for the accuracy or reliability of any information offered by third-party websites linked through the Site.
                </p>
            </section>

            <section id="limitation-of-damages">
                <h2>Limitation of Damages</h2>
                <p>
                    Under no circumstance shall we have any liability to you for any loss or damage of any kind incurred as a result of the use of the site or reliance on any information provided on the site. Your use of the site and your reliance on any information on the site is solely at your own risk.
                </p>
            </section>
        </LegalPageLayout>
    );
}
