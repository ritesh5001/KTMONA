import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, type Category } from "@/services/catalog";
import { MotionCard } from "@/components/motion/MotionCard";
import { SITE_URL } from "@/lib/site-config";

// Using the same resolver as CategoryCarousel so they look identical
type CategoryItem = Category & {
    image?: string | null;
    imageUrl?: string | null;
};

function resolveCategoryImage(category: CategoryItem): string {
    const raw = category.imageUrl ?? category.image ?? "";
    if (!raw) return "/images/product-placeholder.svg";
    if (raw.startsWith("/")) return raw;
    if (raw.startsWith("https://ik.imagekit.io")) return raw;
    return "/images/product-placeholder.svg";
}

export const metadata: Metadata = {
    title: "All Categories | Shop by Category",
    description:
        "Browse curated ethnic wear categories for men. Shop sherwani, kurta sets, Indo-Western outfits, wedding wear and festive collections from top designers in India.",
    alternates: {
        canonical: `${SITE_URL}/categories`,
    },
    openGraph: {
        title: "All Categories | Shop by Category | KTMONA",
        description:
            "Browse curated ethnic wear categories for men. Shop sherwani, kurta sets, Indo-Western outfits, wedding wear and festive collections.",
        url: `${SITE_URL}/categories`,
        siteName: "KTMONA",
        type: "website",
    },
};

export default async function CategoriesPage() {
    let categories: CategoryItem[] = [];
    try {
        const response = await getCategories();
        categories = (response.categories ?? []).filter((c) => c.isActive);
    } catch (err) {
        console.error("Failed to load categories", err);
    }

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Categories",
                item: `${SITE_URL}/categories`,
            },
        ],
    };

    return (
        <div className="min-h-[calc(100vh-160px)] bg-mist border-t border-border-soft">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <div className="mx-auto max-w-6xl px-6 py-20">
                <div className="mb-12 text-center md:mb-16">
                    <p className="mb-4 text-xs font-medium uppercase tracking-[0.3em] text-brand-strong">
                        Explore All
                    </p>
                    <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
                        Curated Collections
                    </h1>
                </div>

                {categories.length === 0 ? (
                    <div className="rounded-none border border-border-soft bg-card px-6 py-16 text-center text-sm text-muted-foreground max-w-lg mx-auto">
                        No active categories found right now. Check back soon.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 md:gap-6 lg:gap-8">
                        {categories.map((category) => (
                            <Link key={category.id} href={`/marketplace?categoryId=${category.id}`} className="group contents">
                                <MotionCard
                                    imageSrc={resolveCategoryImage(category)}
                                    imageAlt={category.name}
                                    aspectClass="aspect-square"
                                    widthClass="w-full"
                                >
                                    <div className="px-3 py-5 text-center">
                                        <h3 className="line-clamp-2 font-serif text-lg font-normal tracking-tight text-foreground transition-colors duration-300 group-hover:text-brand-strong">
                                            {category.name}
                                        </h3>
                                    </div>
                                </MotionCard>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
