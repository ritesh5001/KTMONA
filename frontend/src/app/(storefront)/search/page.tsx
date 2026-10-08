import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceProductCard, type MarketplaceCardProduct } from "@/components/marketplace-product-card";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/site-config";
import { CACHE_TAGS } from "@/lib/cache-tags";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const SEARCH_PAGE_SIZE = 12;
const SEARCH_REVALIDATE_SECONDS = 180;

type SearchParams = {
  q?: string;
  page?: string;
};

type SearchResponse = {
  data?: Array<{
    id: string;
    title: string;
    images?: string[];
    category?: { id?: string; name: string } | null;
    adminListingPrice?: number | null;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function normalizePage(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}

function buildSearchUrl(query: string, page: number): string {
  const params = new URLSearchParams();
  params.set("q", query);
  if (page > 1) {
    params.set("page", String(page));
  }
  return `/search?${params.toString()}`;
}

function mapSearchItemToCard(item: NonNullable<SearchResponse["data"]>[number]): MarketplaceCardProduct {
  const price = typeof item.adminListingPrice === "number" ? item.adminListingPrice : null;

  return {
    id: item.id,
    title: item.title,
    images: item.images ?? [],
    category: item.category ?? null,
    categoryName: item.category?.name ?? null,
    regularPrice: price,
    adminPrice: price,
    salePrice: price,
    price,
  };
}

async function fetchSearchResults(query: string, page: number): Promise<{
  items: MarketplaceCardProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const empty = {
    items: [] as MarketplaceCardProduct[],
    pagination: {
      page,
      limit: SEARCH_PAGE_SIZE,
      total: 0,
      totalPages: 1,
    },
  };

  if (!API_BASE_URL || !query) {
    return empty;
  }

  try {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("page", String(page));
    params.set("limit", String(SEARCH_PAGE_SIZE));

    const response = await fetch(`${API_BASE_URL}/v1/search?${params.toString()}`, {
      next: {
        revalidate: SEARCH_REVALIDATE_SECONDS,
        tags: [CACHE_TAGS.search, CACHE_TAGS.products],
      },
    });

    if (!response.ok) {
      return empty;
    }

    const data = (await response.json()) as SearchResponse;
    const items = (data.data ?? []).map(mapSearchItemToCard);
    const pagination = data.pagination ?? empty.pagination;

    return {
      items,
      pagination: {
        page: pagination.page || page,
        limit: pagination.limit || SEARCH_PAGE_SIZE,
        total: pagination.total || 0,
        totalPages: Math.max(1, pagination.totalPages || 1),
      },
    };
  } catch {
    return empty;
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}): Promise<Metadata> {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const query = resolvedParams?.q?.trim() ?? "";

  if (!query) {
    return {
      title: "Search Products",
      description: "Search products from verified sellers on KTMONA.",
      alternates: {
        canonical: `${SITE_URL}/search`,
      },
    };
  }

  const canonical = `${SITE_URL}${buildSearchUrl(query, normalizePage(resolvedParams?.page))}`;

  return {
    title: `Search results for "${query}"`,
    description: `Browse KTMONA search results for ${query}.`,
    alternates: {
      canonical,
    },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const query = resolvedParams?.q?.trim() ?? "";
  const page = normalizePage(resolvedParams?.page);
  const { items, pagination } = await fetchSearchResults(query, page);

  const previousHref = pagination.page > 1 ? buildSearchUrl(query, pagination.page - 1) : null;
  const nextHref =
    pagination.page < pagination.totalPages
      ? buildSearchUrl(query, pagination.page + 1)
      : null;

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-strong">Search</p>
          <h1 className="font-serif text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            Showing results for: {query || "—"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {query
              ? `${pagination.total} result${pagination.total === 1 ? "" : "s"}`
              : "Enter a keyword in search to find products."}
          </p>
        </div>

        {!query ? (
          <div className="border border-border-soft bg-card p-10 text-center text-sm text-muted-foreground">
            Enter a keyword in search to find products.
          </div>
        ) : items.length === 0 ? (
          <div className="border border-border-soft bg-card p-10 text-center text-sm text-muted-foreground">
            No results found for &quot;{query}&quot;.
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-4">
              {items.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </section>

            <section className="mt-12 flex items-center justify-between border-t border-border-soft pt-8">
              {previousHref ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={previousHref}>← Previous</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  ← Previous
                </Button>
              )}

              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>

              {nextHref ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={nextHref}>Next →</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next →
                </Button>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
