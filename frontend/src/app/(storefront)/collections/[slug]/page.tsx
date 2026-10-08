import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketplaceProductCard } from "@/components/marketplace-product-card";
import { Card, CardContent } from "@/components/ui/card";
import { SITE_URL } from "@/lib/site-config";
import { CACHE_TAGS, collectionTag } from "@/lib/cache-tags";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const COLLECTION_REVALIDATE_SECONDS = 300;

type CategoryItem = { id: string; name: string; slug?: string; isActive: boolean };

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

async function fetchCategories() {
    if (!API_BASE_URL) return [] as CategoryItem[];
    const response = await fetch(`${API_BASE_URL}/v1/categories`, {
        next: { revalidate: COLLECTION_REVALIDATE_SECONDS, tags: [CACHE_TAGS.categories] },
    });
    if (!response.ok) return [] as CategoryItem[];
    const data = await response.json();
    return (data?.categories ?? []) as CategoryItem[];
}

type Props = {
    params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const categories = await fetchCategories();
    const category = categories.find(c => (c.slug ?? slugify(c.name)) === slug);

    if (!category) return {};

    const title = `Buy ${category.name} Online | KTMONA`;
    const description = `Shop ${category.name.toLowerCase()} online from verified sellers on KTMONA. Secure payments, easy returns and fast shipping across India.`;
    const canonicalUrl = `${SITE_URL}/collections/${slug}`;

    // Generate dynamic keywords based on category name
    const keywords = [
        category.name.toLowerCase(),
        `${category.name.toLowerCase()} online india`,
        `buy ${category.name.toLowerCase()} online`,
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

export default async function CollectionPage({ params }: Props) {
    const { slug } = await params;
    const categories = await fetchCategories();
    const category = categories.find(c => (c.slug ?? slugify(c.name)) === slug);

    if (!category || !category.isActive) {
        notFound();
    }

    const productsResponse = await fetch(`${API_BASE_URL}/v1/products?${new URLSearchParams({ categoryId: category.id, limit: String(50) }).toString()}`, {
        next: {
            revalidate: COLLECTION_REVALIDATE_SECONDS,
            tags: [CACHE_TAGS.products, collectionTag(slug)],
        },
    });
    const productsData = productsResponse.ok ? await productsResponse.json() : null;
    const products = productsData?.data ?? [];

    /* ── Breadcrumb JSON-LD ── */
    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Collections", item: `${SITE_URL}/marketplace` },
            { "@type": "ListItem", position: 3, name: category.name, item: `${SITE_URL}/collections/${slug}` },
        ],
    };

    /* ── ItemList JSON-LD ── */
    const itemListJsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${category.name} Collection`,
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

            {/* Simplified Hero Section */}
            <section className="border-b border-border-soft bg-mist/30 dark:bg-card/30">
                <div className="mx-auto max-w-6xl px-6 py-20 text-center">
                    <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-strong mb-4">
                        Exclusive Collection
                    </p>
                    <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                        {category.name}
                    </h1>
                    <p className="mt-6 text-base text-muted-foreground max-w-2xl mx-auto">
                        Discover our curated selection of premium {category.name.toLowerCase()} for men.
                        Handpicked from verified sellers, with secure payments and easy returns.
                    </p>
                </div>
            </section>

            {/* Product Grid */}
            <section className="mx-auto max-w-6xl px-6 py-16">
                <div className="flex items-center justify-between mb-8">
                    <p className="text-sm text-muted-foreground uppercase tracking-wider">
                        {products.length} Products
                    </p>
                    <Link
                        href="/marketplace"
                        className="text-xs font-medium uppercase tracking-[0.15em] text-ink dark:text-paper hover:text-brand-strong transition-colors"
                    >
                        ← Back to All Collections
                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-4">
                    {products.length === 0 ? (
                        <Card className="col-span-2 md:col-span-3 lg:col-span-4 border-border-soft">
                            <CardContent className="p-12 text-center text-muted-foreground">
                                No items currently available in this collection.
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
