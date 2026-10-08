import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketplaceProductCard } from "@/components/marketplace-product-card";
import { SITE_URL } from "@/lib/site-config";
import { CACHE_TAGS, collectionTag, occasionTag } from "@/lib/cache-tags";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const MARKETPLACE_REVALIDATE_SECONDS = 300;

type SearchParams = {
  page?: string;
  categoryId?: string;
  category?: string;
  occasion?: string;
  audience?: string;
  search?: string;
  sort?: string;
};

type Audience = "MENS" | "KIDS";

function parseAudience(value?: string): Audience | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  return upper === "MENS" || upper === "KIDS" ? (upper as Audience) : undefined;
}

type CategoryItem = {
  id: string;
  name: string;
  slug?: string;
};

type OccasionItem = {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  isActive: boolean;
};

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "popularity", label: "Popularity" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fetchCategories() {
  if (!API_BASE_URL) {
    return [] as CategoryItem[];
  }
  const response = await fetch(`${API_BASE_URL}/v1/categories`, {
    next: { revalidate: MARKETPLACE_REVALIDATE_SECONDS, tags: [CACHE_TAGS.categories] },
  });
  if (!response.ok) {
    return [] as CategoryItem[];
  }
  const data = await response.json();
  return (data?.categories ?? []) as CategoryItem[];
}

async function fetchOccasions() {
  if (!API_BASE_URL) {
    return [] as OccasionItem[];
  }
  const response = await fetch(`${API_BASE_URL}/v1/occasions`, {
    next: { revalidate: MARKETPLACE_REVALIDATE_SECONDS, tags: [CACHE_TAGS.occasions] },
  });
  if (!response.ok) {
    return [] as OccasionItem[];
  }
  const data = await response.json();
  return (data?.occasions ?? []) as OccasionItem[];
}

async function fetchProducts(params: {
  page: number;
  limit: number;
  categoryId?: string;
  categorySlug?: string;
  occasion?: string;
  audience?: Audience;
  search?: string;
  sort?: string;
}) {
  if (!API_BASE_URL) {
    return { data: [], pagination: { page: 1, limit: params.limit, total: 0, totalPages: 1 } };
  }
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("limit", String(params.limit));
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.occasion) query.set("occasion", params.occasion);
  if (params.audience) query.set("audience", params.audience);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);

  const tags = [
    CACHE_TAGS.products,
    CACHE_TAGS.search,
    CACHE_TAGS.categories,
    CACHE_TAGS.occasions,
    params.categorySlug ? collectionTag(params.categorySlug) : null,
    params.occasion ? occasionTag(params.occasion) : null,
  ].filter((tag): tag is string => Boolean(tag));

  const response = await fetch(`${API_BASE_URL}/v1/products?${query.toString()}`, {
    next: { revalidate: MARKETPLACE_REVALIDATE_SECONDS, tags },
  });
  if (!response.ok) {
    return { data: [], pagination: { page: params.page, limit: params.limit, total: 0, totalPages: 1 } };
  }
  return response.json();
}

/* ── Dynamic SEO metadata ── */
export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}): Promise<Metadata> {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const categorySlug = resolvedParams?.category?.trim().toLowerCase();
  const occasionSlug = resolvedParams?.occasion?.trim();

  let title = "Shop Online from Verified Sellers | KTMONA Marketplace";
  let description =
    "Browse fashion, lifestyle and everyday products from verified sellers across India on KTMONA. Filter by price, size, colour and category, and pay securely with PhonePe.";

  if (occasionSlug) {
    const label = occasionSlug.charAt(0).toUpperCase() + occasionSlug.slice(1).replace(/-/g, " ");
    title = `${label} Collection | Shop Online`;
    description = `Shop the ${label.toLowerCase()} collection on KTMONA. Curated picks from verified sellers with secure payments, easy returns and doorstep delivery.`;
  } else if (categorySlug) {
    const label = categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1).replace(/-/g, " ");
    title = `Buy ${label} Online | Verified Sellers`;
    description = `Buy ${label.toLowerCase()} online in India from verified KTMONA sellers. Compare styles and prices, pay securely and get doorstep delivery.`;
  }

  const params = new URLSearchParams();
  if (categorySlug) params.set("category", categorySlug);
  if (occasionSlug) params.set("occasion", occasionSlug);
  const canonicalPath = params.toString()
    ? `/marketplace?${params.toString()}`
    : "/marketplace";

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${canonicalPath}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonicalPath}`,
      siteName: "KTMONA",
      type: "website",
      images: [
        {
          url: "/og.png",
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const page = Number(resolvedParams?.page ?? "1") || 1;
  const categoryIdParam = resolvedParams?.categoryId?.trim();
  const categorySlugParam = resolvedParams?.category?.trim().toLowerCase();
  const occasionSlug = resolvedParams?.occasion?.trim();
  const audience = parseAudience(resolvedParams?.audience);
  const search = resolvedParams?.search?.trim();
  const sort = resolvedParams?.sort?.trim();

  // The products query only depends on categories when a category filter is
  // present (the slug has to be resolved to an id first). With no category
  // selected — the common case, including the default /marketplace landing —
  // there is no dependency, so start the products request alongside the other
  // two instead of waiting a full round-trip for them to finish first.
  const needsCategoryResolution = Boolean(categoryIdParam || categorySlugParam);

  const unfilteredProductsPromise = needsCategoryResolution
    ? null
    : fetchProducts({
      page,
      limit: 9,
      occasion: occasionSlug,
      audience,
      search,
      sort,
    });

  const [categories, occasions] = await Promise.all([
    fetchCategories(),
    fetchOccasions(),
  ]);

  const selectedCategoryById = categoryIdParam
    ? categories.find((category) => category.id === categoryIdParam)
    : undefined;
  const selectedCategoryBySlug = categorySlugParam
    ? categories.find(
      (category) =>
        (category.slug ?? slugify(category.name)) === categorySlugParam
    )
    : undefined;

  const selectedCategoryId =
    selectedCategoryById?.id ?? selectedCategoryBySlug?.id;

  // Reuse the request started before the category lookup when no category filter
  // was applied; otherwise resolve it now that we know the category id.
  const productsResponse = await (unfilteredProductsPromise ??
    fetchProducts({
      page,
      limit: 9,
      categoryId: selectedCategoryId,
      categorySlug: selectedCategoryById?.slug ?? selectedCategoryBySlug?.slug ?? categorySlugParam,
      occasion: occasionSlug,
      audience,
      search,
      sort,
    }));

  const products = productsResponse?.data ?? [];
  const pagination = productsResponse?.pagination ?? {
    page,
    limit: 9,
    total: 0,
    totalPages: 1,
  };

  const activeOccasions = occasions.filter((occasion) => occasion.isActive);
  const selectedOccasion = activeOccasions.find(
    (occasion) => occasion.slug === occasionSlug
  );

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;

  const activeSort = sort ?? "relevance";
  const activeSortLabel =
    SORT_OPTIONS.find((option) => option.value === activeSort)?.label ?? "Relevance";

  const getCategorySlug = (category: CategoryItem) =>
    category.slug ?? slugify(category.name);

  // null → clear param, undefined → keep current value, string → set
  const buildUrl = (options: {
    nextPage?: number;
    nextOccasion?: string | null;
    nextCategoryId?: string | null;
    nextAudience?: Audience | null;
    nextSearch?: string | null;
    nextSort?: string | null;
  }) => {
    const params = new URLSearchParams();

    const occ = options.nextOccasion === null ? undefined : (options.nextOccasion ?? occasionSlug);
    if (occ) params.set("occasion", occ);

    const catId = options.nextCategoryId === null ? undefined : (options.nextCategoryId ?? selectedCategoryId);
    if (catId) {
      const cat = categories.find((item) => item.id === catId);
      if (cat) params.set("category", getCategorySlug(cat));
      else params.set("categoryId", catId);
    }

    const aud = options.nextAudience === null ? undefined : (options.nextAudience ?? audience);
    if (aud) params.set("audience", aud);

    const s = options.nextSearch === null ? undefined : (options.nextSearch ?? search);
    if (s) params.set("search", s);

    const so = options.nextSort === null ? undefined : (options.nextSort ?? sort);
    if (so) params.set("sort", so);

    const p = options.nextPage ?? page;
    if (p > 1) params.set("page", String(p));

    return `/marketplace?${params.toString()}`;
  };

  /* ── ItemList JSON-LD for product listings ── */
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: selectedOccasion?.name
      ? `${selectedOccasion.name} Collection`
      : selectedCategory
        ? `${selectedCategory.name} Collection`
        : "All Products",
    numberOfItems: products.length,
    itemListElement: products.map((product: any, index: number) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/product/${product.id}`,
      name: product.title,
    })),
  };

  /* ── Breadcrumb JSON-LD ── */
  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Marketplace",
      item: `${SITE_URL}/marketplace`,
    },
  ];

  if (selectedCategory) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: selectedCategory.name,
      item: `${SITE_URL}/marketplace?category=${getCategorySlug(selectedCategory)}`,
    });
  } else if (selectedOccasion) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: selectedOccasion.name,
      item: `${SITE_URL}/marketplace?occasion=${selectedOccasion.slug}`,
    });
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <section className="border-b border-border-soft bg-background">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="overflow-x-auto pb-1">
            <div className="mx-auto flex w-max min-w-full justify-center gap-4 px-1">
            <Link
              href={buildUrl({ nextPage: 1, nextOccasion: null })}
              className="group shrink-0 text-center"
            >
              <div className={`mx-auto h-20 w-20 overflow-hidden rounded-full border-2 transition-colors ${!occasionSlug
                ? "border-brand"
                : "border-border-soft group-hover:border-brand/60"
                }`}>
                <div className="flex h-full w-full items-center justify-center bg-mist text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  All
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">All</p>
            </Link>

            {activeOccasions.map((occasion) => {
              const selected = occasion.slug === occasionSlug;
              return (
                <Link
                  key={occasion.id}
                  href={buildUrl({ nextPage: 1, nextOccasion: occasion.slug })}
                  className="group shrink-0 text-center"
                >
                  <div className={`mx-auto h-20 w-20 overflow-hidden rounded-full border-2 transition-colors ${selected
                    ? "border-brand"
                    : "border-border-soft group-hover:border-brand/60"
                    }`}>
                    {occasion.image ? (
                      <Image
                        src={occasion.image}
                        alt={occasion.name}
                        width={80}
                        height={80}
                        quality={75}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-mist text-lg font-serif text-muted-foreground">
                        {occasion.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className={`mt-2 text-xs font-medium ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                    {occasion.name}
                  </p>
                </Link>
              );
            })}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:gap-12 sm:px-6 sm:py-14 lg:gap-16 lg:py-20">
        <section className="space-y-3 sm:space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-strong">
            Occasion Collections
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="font-serif text-3xl font-light tracking-tight text-foreground sm:text-5xl">
                {selectedOccasion?.name ?? "All Occasions"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {pagination.total} Results
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 border border-border-soft bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Refine Results
            </p>
            {search || sort || selectedCategoryId || audience ? (
              <Link
                href={buildUrl({
                  nextPage: 1,
                  nextSearch: null,
                  nextSort: null,
                  nextCategoryId: null,
                  nextAudience: null,
                })}
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Clear All
              </Link>
            ) : null}
          </div>

          <form
            action="/marketplace"
            method="get"
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"
          >
            {selectedCategoryId ? (
              <input type="hidden" name="categoryId" value={selectedCategoryId} />
            ) : null}
            {occasionSlug ? (
              <input type="hidden" name="occasion" value={occasionSlug} />
            ) : null}
            {audience ? (
              <input type="hidden" name="audience" value={audience} />
            ) : null}

            <label className="relative block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                name="search"
                defaultValue={search ?? ""}
                placeholder="Search collections, styles..."
                className="h-10 w-full border border-border-soft bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-brand/60 focus-visible:outline-none"
              />
            </label>

            <label className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Sort
              </span>
              <select
                name="sort"
                defaultValue={activeSort}
                className="h-10 w-full cursor-pointer appearance-none border border-border-soft bg-background pl-14 pr-8 text-xs font-medium uppercase tracking-[0.12em] text-foreground transition-colors focus:border-brand/60 focus-visible:outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </label>

            <Button type="submit" variant="outline" size="sm" className="h-10 px-6">
              Apply
            </Button>
          </form>
        </section>

        <section id="marketplace-audience" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Audience
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={buildUrl({ nextPage: 1, nextAudience: null })}
              className={`shrink-0 border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
                !audience
                  ? "border-brand bg-mist text-ink dark:bg-navy/30 dark:text-paper"
                  : "border-border-soft bg-card text-muted-foreground hover:border-brand/50 hover:text-foreground"
              }`}
            >
              All
            </Link>
            {(["MENS", "KIDS"] as const).map((opt) => (
              <Link
                key={opt}
                href={buildUrl({ nextPage: 1, nextAudience: opt })}
                className={`shrink-0 border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
                  audience === opt
                    ? "border-brand bg-mist text-ink dark:bg-navy/30 dark:text-paper"
                    : "border-border-soft bg-card text-muted-foreground hover:border-brand/50 hover:text-foreground"
                }`}
              >
                {opt === "MENS" ? "Mens" : "Kids"}
              </Link>
            ))}
          </div>
        </section>

        <section id="marketplace-categories" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Category
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 whitespace-nowrap md:flex-wrap md:overflow-visible md:whitespace-normal">
            <Link
              href={buildUrl({ nextPage: 1, nextCategoryId: null })}
              className={`shrink-0 border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
                !selectedCategory
                  ? "border-brand bg-mist text-ink dark:bg-navy/30 dark:text-paper"
                  : "border-border-soft bg-card text-muted-foreground hover:border-brand/50 hover:text-foreground"
              }`}
            >
              All Categories
            </Link>

            {categories.length === 0 ? (
              <span className="px-3 py-2 text-sm text-muted-foreground">
                Categories loading...
              </span>
            ) : (
              categories.map((category) => (
                <Link
                  key={category.id}
                  href={buildUrl({ nextPage: 1, nextCategoryId: category.id })}
                  className={`shrink-0 border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors ${
                    selectedCategory?.id === category.id
                      ? "border-brand bg-mist text-ink dark:bg-navy/30 dark:text-paper"
                      : "border-border-soft bg-card text-muted-foreground hover:border-brand/50 hover:text-foreground"
                  }`}
                >
                  {category.name}
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {pagination.total} {pagination.total === 1 ? "product" : "products"} found
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {search ? (
              <span className="border border-border-soft bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Search: {search}
              </span>
            ) : null}
            {selectedCategory ? (
              <span className="border border-border-soft bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Category: {selectedCategory.name}
              </span>
            ) : null}
            {selectedOccasion ? (
              <span className="border border-border-soft bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Occasion: {selectedOccasion.name}
              </span>
            ) : null}
            {audience ? (
              <span className="border border-border-soft bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Audience: {audience === "MENS" ? "Mens" : "Kids"}
              </span>
            ) : null}
            {activeSortLabel !== "Relevance" ? (
              <span className="border border-border-soft bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Sort: {activeSortLabel}
              </span>
            ) : null}
          </div>
        </section>

        {/* Products Grid */}
        <section className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.length === 0 ? (
            <Card className="col-span-2 md:col-span-3 lg:col-span-4 border-border-soft">
              <CardContent className="p-8 text-center text-muted-foreground">
                No products found. Try adjusting your search or filters.
              </CardContent>
            </Card>
          ) : (
            products.map((product: any) => (
              <MarketplaceProductCard key={product.id} product={product} />
            ))
          )}
        </section>

        {/* Pagination */}
        <section className="flex items-center justify-between border-t border-border-soft pt-5 sm:pt-8">
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
          >
            <Link
              href={buildUrl({ nextPage: Math.max(pagination.page - 1, 1) })}
            >
              ← Previous
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
          >
            <Link
              href={buildUrl({ nextPage: Math.min(pagination.page + 1, pagination.totalPages) })}
            >
              Next →
            </Link>
          </Button>
        </section>
        {/* SEO Quick Links — Explore Collections: temporarily hidden, will be unhidden later
        <section className="border-t border-border-soft pt-7 pb-2 sm:pt-12 sm:pb-4">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-strong">Explore Collections</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/collections/kurta" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4">Kurtas</Link>
              <Link href="/collections/sherwani" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4">Sherwanis</Link>
              <Link href="/collections/indo-western" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4">Indo-Western</Link>
              <Link href="/occasion/wedding" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4">Wedding</Link>
              <Link href="/occasion/haldi" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4">Haldi</Link>
              <Link href="/occasion/sangeet" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4">Sangeet</Link>
            </div>
          </div>
        </section>
        */}
      </div>
    </div>
  );
}
