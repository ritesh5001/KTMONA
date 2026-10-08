import React from "react";
import Link from "next/link";
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from "@/lib/site-config";

interface Section {
    id: string;
    title: string;
}

interface LegalPageLayoutProps {
    title: string;
    lastUpdated: string;
    sections?: Section[];
    children: React.ReactNode;
}

export function LegalPageLayout({
    title,
    lastUpdated,
    sections,
    children,
}: LegalPageLayoutProps) {
    return (
        <div className="min-h-screen bg-background font-sans text-foreground">
            {/* Hero Header */}
            <header className="bg-mist py-16 md:py-24 border-b border-border-soft">
                <div className="mx-auto max-w-4xl px-6">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong">
                        Legal & Policies
                    </p>
                    <h1 className="text-4xl md:text-5xl font-serif text-ink font-light tracking-tight mb-4">
                        {title}
                    </h1>
                    <p className="text-sm text-muted-foreground uppercase tracking-wider">
                        Last Updated: {lastUpdated}
                    </p>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="mx-auto max-w-6xl px-6 py-12 md:py-20 flex flex-col md:flex-row gap-12 lg:gap-24 relative items-start">

                {/* Sticky Sidebar ToC (Desktop only) */}
                {sections && sections.length > 0 && (
                    <aside className="hidden md:block w-64 shrink-0 sticky top-24 self-start border-l-2 border-border-soft pl-6 py-2">
                        <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-brand-strong mb-6">On this page</h3>
                        <nav className="flex flex-col space-y-4">
                            {sections.map((section) => (
                                <Link
                                    key={section.id}
                                    href={`#${section.id}`}
                                    className="text-sm text-muted-foreground hover:text-brand-strong transition-colors duration-200"
                                >
                                    {section.title}
                                </Link>
                            ))}
                        </nav>
                    </aside>
                )}

                {/* Content Container (max-w-4xl, sharp edges) */}
                <main className="flex-1 max-w-4xl min-w-0 bg-white p-0 md:p-8 outline outline-1 outline-border-soft/30 shadow-sm rounded-none md:shadow-md md:outline-border-soft relative">
                    <div className="prose prose-stone prose-headings:font-serif prose-headings:font-light prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:pb-4 prose-h2:border-b prose-h2:border-border-soft prose-p:leading-relaxed prose-p:text-ink/80 prose-li:text-ink/80 prose-a:text-brand-strong hover:prose-a:text-brand-strong/80 prose-strong:text-ink max-w-none">
                        {children}

                        <hr className="my-12 border-border-soft" />

                        <div className="bg-mist p-6 rounded-none border border-border-soft mt-12">
                            <h3 className="font-serif text-xl mb-3 text-ink">Need further assistance?</h3>
                            <p className="text-sm text-muted-foreground mb-0">
                                If you have any questions regarding these terms or policies, please contact our support team at <br />
                                <strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-strong no-underline hover:underline">{SUPPORT_EMAIL}</a><br />
                                <strong>Phone:</strong> {SUPPORT_PHONE_DISPLAY}
                            </p>
                        </div>
                    </div>
                </main>

            </div>
        </div>
    );
}
