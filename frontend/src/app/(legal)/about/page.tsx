import { Metadata } from "next";
import Link from "next/link";
import {
    BookOpen,
    CircleCheck,
    Eye,
    Headphones,
    Mail,
    MapPin,
    MessageCircleMore,
    Phone,
    ShieldCheck,
    Store,
    Target,
    Truck,
    User,
    Users,
} from "lucide-react";
import { COMPANY_ADDRESS, SUPPORT_EMAIL, SUPPORT_PHONE_DIAL, SUPPORT_PHONE_DISPLAY } from "@/lib/site-config";

export const metadata: Metadata = {
    title: "About Us | KTMONA",
    description: "KTMONA (Knowledge, Trust & More Online Network Access) is a multi-vendor marketplace connecting customers across India with verified independent sellers. Trust Every Click.",
};

const SECTIONS = [
    { id: "our-story", title: "Our Story", icon: BookOpen },
    { id: "founder", title: "Meet Our Founder", icon: User },
    { id: "our-mission", title: "Our Mission", icon: CircleCheck },
    { id: "why-choose-us", title: "Why Choose Us", icon: ShieldCheck },
    { id: "head-office", title: "Head Office", icon: MapPin },
];

const REASONS = [
    { icon: ShieldCheck, title: "Trusted marketplace", body: "Safe, secure & authentic" },
    { icon: Users, title: "Seller opportunities", body: "Grow your business" },
    { icon: Truck, title: "Convenient shopping", body: "Wide range, easy access" },
    { icon: Headphones, title: "Customer-first support", body: "We're always here" },
];

interface Founder {
    name: string;
    title: string;
    bio: string;
    quote: string | null;
    photoUrl: string | null;
}

/** Admin → About Us: Founders. Re-read every few minutes. */
async function getFounders(): Promise<Founder[]> {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!api) return [];
    try {
        const res = await fetch(`${api}/v1/site/founders`, { next: { revalidate: 300 } });
        if (!res.ok) return [];
        const body = (await res.json()) as { data?: { founders?: Founder[] } };
        return body.data?.founders ?? [];
    } catch {
        return [];
    }
}

const card = "rounded-2xl border border-border bg-card shadow-sm";

function CardTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
    return (
        <h2 className="flex items-center gap-2.5 text-lg font-semibold text-ink">
            <Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden />
            {children}
        </h2>
    );
}

/** Shopping bags with the K mark, linked to "Customers" and "Sellers". */
function HeroIllustration() {
    return (
        <div className="relative mx-auto h-48 w-full max-w-md sm:h-56" aria-hidden>
            <div className="absolute inset-x-6 bottom-0 top-6 rounded-full bg-[#DCE7FB]/70 blur-2xl" />
            <svg viewBox="0 0 320 220" className="absolute inset-0 h-full w-full">
                {/* leaves */}
                <path d="M40 200c-6-40 10-70 34-86-4 30-12 60-34 86z" fill="#9DB8F2" opacity=".7" />
                <path d="M52 204c10-32 30-50 56-58-12 26-28 46-56 58z" fill="#7FA2EC" opacity=".6" />
                {/* dotted links to the chips */}
                <path d="M222 70 C250 40 262 34 282 30" fill="none" stroke="#9DB0D6" strokeWidth="1.5" strokeDasharray="3 4" />
                <path d="M226 120 C254 112 266 106 284 98" fill="none" stroke="#9DB0D6" strokeWidth="1.5" strokeDasharray="3 4" />
                <circle cx="248" cy="52" r="3.5" fill="#2F6BF0" />
                {/* orange bag (back) */}
                <path d="M150 54c0-20 12-32 28-32s28 12 28 32" fill="none" stroke="#F07A12" strokeWidth="5" strokeLinecap="round" />
                <path d="M136 52h86l10 150h-106z" fill="#FF8A00" />
                <path d="M222 52l10 150h-14l-6-150z" fill="#E05A00" opacity=".5" />
                {/* navy bag (front) */}
                <path d="M96 76c0-22 14-36 32-36s32 14 32 36" fill="none" stroke="#0C1B42" strokeWidth="6" strokeLinecap="round" />
                <path d="M76 74h104l8 136H68z" fill="#102462" />
                <path d="M180 74l8 136h-16l-4-136z" fill="#0C1B42" />
                <image href="/ktmona-icon.png" x="94" y="102" width="76" height="76" />
                {/* parcel */}
                <path d="M190 150l50-14 44 14v58h-94z" fill="#D9A877" />
                <path d="M190 150h94v58h-94z" fill="#E7BC8E" />
                <path d="M190 150l50-14 44 14z" fill="#C99566" />
                <rect x="206" y="172" width="30" height="20" rx="2" fill="#fff" opacity=".9" />
                <path d="M211 178h20M211 184h14" stroke="#9AA6BE" strokeWidth="2" />
                {/* heart */}
                <path d="M270 70c-6-6-14 2-6 8l6 6 6-6c8-6 0-14-6-8z" fill="#FF8A00" />
            </svg>
            <div className="absolute right-0 top-0 flex items-center gap-2 text-sm font-medium text-ink">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white shadow-md">
                    <User className="h-5 w-5" />
                </span>
                <span className="hidden sm:inline">Customers</span>
            </div>
            <div className="absolute right-0 top-[40%] flex items-center gap-2 text-sm font-medium text-ink">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2F6BF0] text-white shadow-md">
                    <Store className="h-5 w-5" />
                </span>
                <span className="hidden sm:inline">Sellers</span>
            </div>
        </div>
    );
}

export default async function AboutPage() {
    const founders = await getFounders();
    const sections = founders.length ? SECTIONS : SECTIONS.filter((s) => s.id !== "founder");

    return (
        <div className="min-h-screen bg-background font-sans text-foreground">
            {/* Hero */}
            <header className="overflow-hidden border-b border-border bg-gradient-to-r from-[#F3F7FE] via-[#EEF3FC] to-[#E6EEFB]">
                <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-14">
                    <div>
                        <p className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong">
                            <span className="h-px w-8 bg-brand-strong" aria-hidden />
                            About KTMONA
                        </p>
                        <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                            Shopping that builds <span className="text-brand">trust.</span>
                        </h1>
                        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                            A marketplace bringing customers and independent sellers closer — with confidence, convenience and opportunity.
                        </p>
                    </div>
                    <HeroIllustration />
                </div>
            </header>

            <div className="mx-auto flex max-w-7xl items-start gap-10 px-4 py-10 sm:px-6 md:py-14">
                {/* On this page */}
                <aside className="sticky top-24 hidden w-52 shrink-0 self-start border-l border-border py-1 pl-4 md:block">
                    <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-brand-strong">On this page</p>
                    <nav className="flex flex-col gap-1">
                        {sections.map(({ id, title, icon: Icon }) => (
                            <Link
                                key={id}
                                href={`#${id}`}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong"
                            >
                                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                                {title}
                            </Link>
                        ))}
                    </nav>
                </aside>

                <main className="min-w-0 flex-1 space-y-5">
                    {/* Story + founder */}
                    <section id="our-story" className={`${card} scroll-mt-24 p-5 sm:p-7`}>
                        <CardTitle icon={BookOpen}>Our Story</CardTitle>
                        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                            <p>
                                &ldquo;Trust Every Click.&rdquo; KTMONA stands for{" "}
                                <strong className="text-ink">&ldquo;Knowledge, Trust &amp; More Online Network Access.&rdquo;</strong>{" "}
                                We&apos;re building a multi-vendor marketplace where customers can discover everyday products from independent sellers across India, while sellers get a simple way to grow their businesses.
                            </p>
                            <p>
                                KTMONA is a multi-vendor marketplace where small businesses, resellers and home-based sellers across India list their products, and customers shop with secure payments, tracked delivery and easy returns. Every seller is approved by our team and every product is reviewed before it goes live.
                            </p>
                        </div>

                        {founders.length ? (
                            <div id="founder" className="mt-6 scroll-mt-24 space-y-6">
                                {founders.map((f) => (
                                    <div key={f.name} className="flex flex-col gap-5 sm:flex-row sm:items-start">
                                        {f.photoUrl ? (
                                            <img src={f.photoUrl} alt={f.name} className="h-40 w-36 shrink-0 rounded-xl object-cover shadow-sm" />
                                        ) : null}
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-strong">
                                                {founders.length === 1 ? "Meet Our Founder" : "Meet Our Founders"}
                                            </p>
                                            <h3 className="mt-2 text-xl font-bold text-ink">{f.name}</h3>
                                            {f.title ? <p className="text-sm text-ink/80">{f.title}</p> : null}
                                            {f.quote ? (
                                                <p className="mt-3 border-t border-border pt-3 text-sm italic leading-relaxed text-muted-foreground">
                                                    &ldquo;{f.quote}&rdquo;
                                                </p>
                                            ) : null}
                                            {f.bio ? <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{f.bio}</p> : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </section>

                    {/* Mission / Vision / Why */}
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.5fr]">
                        <section id="our-mission" className={`${card} scroll-mt-24 p-5`}>
                            <CardTitle icon={Target}>Our Mission</CardTitle>
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                Our mission is to give every seller in India a simple, transparent way to sell online, and every customer a safe, reliable and enjoyable shopping experience.
                            </p>
                        </section>
                        <section className={`${card} p-5`}>
                            <CardTitle icon={Eye}>Our Vision</CardTitle>
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                To become India&apos;s most trusted and customer-first e-commerce platform, empowering millions of sellers and shoppers with technology, transparency and opportunity.
                            </p>
                        </section>
                        <section id="why-choose-us" className={`${card} scroll-mt-24 p-5 md:col-span-2 xl:col-span-1`}>
                            <CardTitle icon={ShieldCheck}>Why Choose Us</CardTitle>
                            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
                                {REASONS.map(({ icon: Icon, title, body }) => (
                                    <li key={title} className="flex items-center gap-3">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist text-ink">
                                            <Icon className="h-[18px] w-[18px]" aria-hidden />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-ink">{title}</span>
                                            <span className="block text-xs text-muted-foreground">{body}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    {/* Head office */}
                    <section id="head-office" className={`${card} scroll-mt-24 flex items-center gap-4 p-5`}>
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-brand-strong">
                            <MapPin className="h-5 w-5" aria-hidden />
                        </span>
                        <div>
                            <h2 className="text-lg font-semibold text-ink">Head Office</h2>
                            <p className="text-sm text-muted-foreground">{COMPANY_ADDRESS}</p>
                        </div>
                    </section>

                    {/* Support */}
                    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-mist p-5 sm:flex-row sm:items-center sm:p-6">
                        <MessageCircleMore className="h-10 w-10 shrink-0 text-navy" aria-hidden />
                        <div className="min-w-0 sm:border-l sm:border-border sm:pl-6">
                            <h2 className="text-lg font-semibold text-ink">Need further assistance?</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                If you have any questions, please contact our support team at
                            </p>
                            <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-8">
                                <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 break-all text-ink hover:text-brand-strong">
                                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                                    <strong>Email:</strong> <span className="text-brand-strong">{SUPPORT_EMAIL}</span>
                                </a>
                                <a href={`tel:${SUPPORT_PHONE_DIAL}`} className="inline-flex items-center gap-2 text-ink hover:text-brand-strong">
                                    <Phone className="h-4 w-4 shrink-0" aria-hidden />
                                    <strong>Phone:</strong> {SUPPORT_PHONE_DISPLAY}
                                </a>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
