import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: SITE_URL,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 1,
        },
        {
            url: `${SITE_URL}/marketplace`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${SITE_URL}/categories`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/blog`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/blog/trending-wedding-outfits-for-men-2026`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${SITE_URL}/blog/how-to-style-kurta-pajama-for-haldi`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.7,
        },
    ];

    /* ── Fetch all products ── */
    let productRoutes: MetadataRoute.Sitemap = [];
    try {
        if (API_BASE_URL) {
            // The products API caps `limit` at 20, so page through the results.
            // Previously this requested limit=1000 and got a 400, which the catch
            // swallowed — leaving the sitemap with no product URLs at all.
            const PAGE_SIZE = 20;
            const MAX_PAGES = 100; // safety bound (≈2000 products)
            const products: any[] = [];

            for (let page = 1; page <= MAX_PAGES; page++) {
                const res = await fetch(
                    `${API_BASE_URL}/v1/products?limit=${PAGE_SIZE}&page=${page}`,
                    { next: { revalidate: 3600 } }
                );
                if (!res.ok) break;

                const data = await res.json();
                const batch = data?.data ?? [];
                products.push(...batch);

                const totalPages = data?.pagination?.totalPages ?? 1;
                if (batch.length === 0 || page >= totalPages) break;
            }

            productRoutes = products.map((product: any) => ({
                url: `${SITE_URL}/product/${product.id}`,
                lastModified: product.updatedAt
                    ? new Date(product.updatedAt)
                    : new Date(),
                changeFrequency: "weekly" as const,
                priority: 0.7,
            }));
        }
    } catch {
        /* silently skip if API is not available */
    }

    /* ── Fetch all categories ── */
    let categoryRoutes: MetadataRoute.Sitemap = [];
    try {
        if (API_BASE_URL) {
            const res = await fetch(`${API_BASE_URL}/v1/categories`, {
                next: { revalidate: 3600 },
            });
            if (res.ok) {
                const data = await res.json();
                const categories = data?.categories ?? [];
                categoryRoutes = categories
                    .filter((cat: any) => cat.isActive)
                    .flatMap((cat: any) => {
                        const slug =
                            cat.slug ??
                            cat.name
                                .toLowerCase()
                                .trim()
                                .replace(/[^a-z0-9]+/g, "-")
                                .replace(/(^-|-$)/g, "");
                        return [
                            {
                                url: `${SITE_URL}/marketplace?category=${slug}`,
                                lastModified: new Date(),
                                changeFrequency: "weekly" as const,
                                priority: 0.8,
                            },
                            {
                                url: `${SITE_URL}/collections/${slug}`,
                                lastModified: new Date(),
                                changeFrequency: "weekly" as const,
                                priority: 0.9,
                            }
                        ];
                    });
            }
        }
    } catch {
        /* silently skip */
    }

    /* ── Fetch all occasions ── */
    let occasionRoutes: MetadataRoute.Sitemap = [];
    try {
        if (API_BASE_URL) {
            const res = await fetch(`${API_BASE_URL}/v1/occasions`, {
                next: { revalidate: 3600 },
            });
            if (res.ok) {
                const data = await res.json();
                const occasions = data?.occasions ?? [];
                occasionRoutes = occasions
                    .filter((occ: any) => occ.isActive)
                    .flatMap((occ: any) => [
                        {
                            url: `${SITE_URL}/marketplace?occasion=${occ.slug}`,
                            lastModified: new Date(),
                            changeFrequency: "weekly" as const,
                            priority: 0.8,
                        },
                        {
                            url: `${SITE_URL}/occasion/${occ.slug}`,
                            lastModified: new Date(),
                            changeFrequency: "weekly" as const,
                            priority: 0.9,
                        }
                    ]);
            }
        }
    } catch {
        /* silently skip */
    }

    return [
        ...staticRoutes,
        ...productRoutes,
        ...categoryRoutes,
        ...occasionRoutes,
    ];
}
