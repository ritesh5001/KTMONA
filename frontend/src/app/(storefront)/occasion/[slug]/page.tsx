import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketplaceProductCard } from "@/components/marketplace-product-card";
import { Card, CardContent } from "@/components/ui/card";
import { SITE_URL } from "@/lib/site-config";
import { CACHE_TAGS, occasionTag } from "@/lib/cache-tags";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const OCCASION_REVALIDATE_SECONDS = 300;

type OccasionItem = { id: string; name: string; slug: string; isActive: boolean; image?: string };

async function fetchOccasions() {
    if (!API_BASE_URL) return [] as OccasionItem[];
    const response = await fetch(`${API_BASE_URL}/v1/occasions`, {
        next: { revalidate: OCCASION_REVALIDATE_SECONDS, tags: [CACHE_TAGS.occasions] },
    });
    if (!response.ok) return [] as OccasionItem[];
    const data = await response.json();
    return (data?.occasions ?? []) as OccasionItem[];
}

async function fetchProducts(occasionSlug: string, limit: number = 20) {
    if (!API_BASE_URL) return [];
    const query = new URLSearchParams({ occasion: occasionSlug, limit: String(limit) });
    const response = await fetch(`${API_BASE_URL}/v1/products?${query.toString()}`, {
        next: {
            revalidate: OCCASION_REVALIDATE_SECONDS,
            tags: [CACHE_TAGS.products, occasionTag(occasionSlug)],
        },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data?.data ?? [];
}

type Props = {
    params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const occasions = await fetchOccasions();
    const occasion = occasions.find(o => o.slug === slug);

    if (!occasion) return {};

    const title = `${occasion.name} Collection | Shop Online | KTMONA`;
    const description = `Shop the ${occasion.name.toLowerCase()} collection on KTMONA. Curated picks from verified sellers, with secure payments and doorstep delivery.`;
    const canonicalUrl = `${SITE_URL}/occasion/${slug}`;

    const keywords = [
        `${occasion.name.toLowerCase()} collection`,
        `${occasion.name.toLowerCase()} shopping online`,
        `buy for ${occasion.name.toLowerCase()} online`,
        "KTMONA marketplace",
        "verified sellers india",
    ];

    return {
        title,
        description,
        keywords,
        alternates: { canonical: canonicalUrl },
        openGraph: {
            title,
            description,
            url: canonicalUrl,
            images: ["/og.png"],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: ["/og.png"],
        },
    };
}

export default async function OccasionPage({ params }: Props) {
    const { slug } = await params;
    const occasions = await fetchOccasions();
    const occasion = occasions.find(o => o.slug === slug);

    if (!occasion || !occasion.isActive) {
        notFound();
    }

    const products = await fetchProducts(occasion.slug, 50);

    /* ── Breadcrumb JSON-LD ── */
    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Occasions", item: `${SITE_URL}/marketplace` },
            { "@type": "ListItem", position: 3, name: occasion.name, item: `${SITE_URL}/occasion/${slug}` },
        ],
    };

    /* ── ItemList JSON-LD ── */
    const itemListJsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${occasion.name} Edit`,
        numberOfItems: products.length,
        itemListElement: products.map((product: any, index: number) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${SITE_URL}/product/${product.id}`,
            name: product.title,
        })),
    };

    return (
        <div className="bg-background min-h-screen">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

            <section className="border-b border-border-soft bg-mist/30 dark:bg-card/30">
                <div className="mx-auto max-w-6xl px-6 py-20 text-center">
                    <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-strong mb-4">
                        Curated For
                    </p>
                    <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                        The {occasion.name}
                    </h1>
                    <p className="mt-6 text-base text-muted-foreground max-w-2xl mx-auto">
                        Elevate your presence with our meticulously styled looks for {occasion.name.toLowerCase()}.
                        Curated picks from verified sellers for every celebration.
                    </p>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-6 py-16">
                <div className="flex items-center justify-between mb-8">
                    <p className="text-sm text-muted-foreground uppercase tracking-wider">
                        {products.length} Products
                    </p>
                    <Link
                        href="/marketplace"
                        className="text-xs font-medium uppercase tracking-[0.15em] text-ink dark:text-paper hover:text-brand-strong transition-colors"
                    >
                        ← View All Occasions
                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-4">
                    {products.length === 0 ? (
                        <Card className="col-span-2 md:col-span-3 lg:col-span-4 border-border-soft">
                            <CardContent className="p-12 text-center text-muted-foreground">
                                No items currently available for this occasion.
                            </CardContent>
                        </Card>
                    ) : (
                        products.map((product: any) => (
                            <MarketplaceProductCard key={product.id} product={product} />
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}
