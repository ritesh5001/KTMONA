import type { Metadata } from "next";
import Link from "next/link";
import { getCategories } from "@/services/catalog";
import { buildCategoryTree, categoryHref, type CategoryNode } from "@/lib/category-tree";
import { CategoryArt } from "@/components/storefront/category-visuals";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "All Categories | Shop by Category",
  description:
    "Browse every KTMONA category: sarees and kurtis, western wear, menswear, kids and toys, home and kitchen, beauty, jewellery, footwear, electronics and more from verified sellers.",
  alternates: { canonical: `${SITE_URL}/categories` },
  openGraph: {
    title: "All Categories | KTMONA",
    description: "Shop fashion, home, beauty, electronics and more by category on KTMONA.",
    url: `${SITE_URL}/categories`,
    siteName: "KTMONA",
    type: "website",
  },
};

export default async function CategoriesPage() {
  let tree: CategoryNode[] = [];
  try {
    tree = buildCategoryTree((await getCategories()).categories);
  } catch (err) {
    console.error("Failed to load categories", err);
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Categories", item: `${SITE_URL}/categories` },
    ],
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 xl:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link> / <span className="text-foreground">All Categories</span>
      </nav>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">All Categories</h1>

      {tree.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border-soft bg-card p-10 text-center text-muted-foreground">Categories are loading. Please refresh in a moment.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {tree.map((main) => (
            <section key={main.id} id={main.slug} className="rounded-xl border border-border-soft bg-card p-4 sm:p-5">
              <Link href={categoryHref(main.slug)} className="group flex items-center gap-3">
                <CategoryArt slug={main.slug} image={main.image} name={main.name} className="h-12 w-12 shrink-0 rounded-full" />
                <h2 className="text-lg font-semibold group-hover:text-brand-strong">{main.name}</h2>
                <span className="ml-auto text-sm font-semibold text-brand-strong">View all ›</span>
              </Link>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                {main.children.map((group) => (
                  <div key={group.id}>
                    <Link href={categoryHref(group.slug)} className="text-sm font-semibold hover:text-brand-strong">{group.name}</Link>
                    <ul className="mt-1.5 space-y-1">
                      {group.children.map((leaf) => (
                        <li key={leaf.id}>
                          <Link href={categoryHref(leaf.slug)} className="text-[13px] text-muted-foreground hover:text-foreground">{leaf.name}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
