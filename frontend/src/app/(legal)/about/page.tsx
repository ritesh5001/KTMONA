import { LegalPageLayout } from "@/components/legal-page-layout";
import { Metadata } from "next";
import { COMPANY_ADDRESS } from "@/lib/site-config";

export const metadata: Metadata = {
    title: "About Us | KTMONA",
    description: "KTMONA (Knowledge, Trust & More Online Network Access) is a multi-vendor marketplace connecting customers across India with verified independent sellers. Trust Every Click.",
};

const SECTIONS = [
    { id: "our-story", title: "Our Story" },
    { id: "our-mission", title: "Our Mission" },
    { id: "why-choose-us", title: "Why Choose Us" },
    { id: "head-office", title: "Head Office" },
];

export default function AboutPage() {
    return (
        <LegalPageLayout
            title="About Us"
            lastUpdated="October 5, 2026"
            sections={SECTIONS}
        >
            <section id="our-story">
                <h2>Our Story</h2>
                <p>
                    &ldquo;Trust Every Click.&rdquo; KTMONA stands for <strong>Knowledge, Trust &amp; More Online Network Access</strong>. We built KTMONA so that shopping online from independent sellers feels as safe as buying from a store you already know.
                </p>
                <p>
                    KTMONA is a multi-vendor marketplace where small businesses, resellers and home-based sellers across India list their products, and customers shop with secure payments, tracked delivery and easy returns. Every seller is approved by our team and every product is reviewed before it goes live.
                </p>
            </section>

            <section id="our-mission">
                <h2>Our Mission</h2>
                <p>
                    Our mission is to give every seller in India a simple, transparent way to sell online, and every customer a marketplace they can trust with each click.
                </p>
                <ul>
                    <li><strong>Knowledge:</strong> Clear product information, honest reviews and simple tools for first-time online sellers.</li>
                    <li><strong>Trust:</strong> Verified sellers, admin-approved listings and secure payments.</li>
                    <li><strong>Access:</strong> Shop or sell from anywhere on the web and on the KTMONA app for Android and iOS.</li>
                </ul>
            </section>

            <section id="why-choose-us">
                <h2>Why Choose Us</h2>
                <p>
                    By choosing KTMONA, you get:
                </p>
                <ul>
                    <li>Products from verified sellers across India, all in one place.</li>
                    <li>Secure PhonePe payments and a downloadable invoice for every order.</li>
                    <li>Live shipment tracking and easy returns on delivered orders.</li>
                    <li>Dedicated customer and seller support whenever you need it.</li>
                </ul>
            </section>

            <section id="head-office">
                <h2>Head Office</h2>
                <p>{COMPANY_ADDRESS}</p>
            </section>
        </LegalPageLayout>
    );
}
