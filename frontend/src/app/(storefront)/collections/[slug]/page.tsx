import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductFeed } from "@/components/storefront/ProductFeed";
import { CategoryArt } from "@/components/storefront/category-visuals";
import { buildCategoryTree, categoryHref, pathTo, type CategoryNode, type FlatCategory } from "@/lib/category-tree";
import { SITE_URL } from "@/lib/site-config";
import { CACHE_TAGS } from "@/lib/cache-tags";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const COLLECTION_REVALIDATE_SECONDS = 300;

async function loadTree(): Promise<CategoryNode[]> {
  if (!API_BASE_URL) return [];
  try {
    const response = await fetch(`${API_BASE_URL}/v1/categories`, {
      next: { revalidate: COLLECTION_REVALIDATE_SECONDS, tags: [CACHE_TAGS.categories] },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { categories?: FlatCategory[] };
    return buildCategoryTree(data.categories);
  } catch {
    return [];
  }
}

type Props = { params: Promise<{ slug: string }> };

/** Without children, so the client-side filter list stays small. */
const shallow = (nodes: CategoryNode[]) => nodes.map(({ children: _c, ...n }) => ({ ...n, children: [] }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const path = pathTo(await loadTree(), slug);
  const category = path[path.length - 1];
  if (!category) return {};

  const parent = path.length > 1 ? path[path.length - 2]!.name : null;
  const title = category.seoTitle ?? `Buy ${category.name} Online${parent && parent !== category.name ? ` | ${parent}` : ""} | KTMONA`;
  const description =
    category.seoDescription ??
    category.description ??
    `Shop ${category.name.toLowerCase()} online from verified sellers on KTMONA. Secure payments, easy returns and delivery across India.`;
  const canonicalUrl = `${SITE_URL}/collections/${slug}`;

  return {
    title,
    description,
    keywords: [category.name.toLowerCase(), `${category.name.toLowerCase()} online`, `buy ${category.name.toLowerCase()} online india`, "KTMONA"],
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, images: [category.bannerImage ?? "/og.png"] },
    twitter: { card: "summary_large_image", title, description, images: [category.bannerImage ?? "/og.png"] },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const tree = await loadTree();
  const path = pathTo(tree, slug);
  const category = path[path.length - 1];
  if (!category) notFound();

  const main = path[0]!;
  const parent = path.length > 1 ? path[path.length - 2]! : null;
  // A leaf lists its siblings in the filter; anything else lists its children.
  const filterLinks = category.children.length > 0 ? category.children : parent?.children.filter((c) => c.id !== category.id) ?? [];
  const filterHeading = category.children.length > 0 ? `Shop in ${category.name}` : `More in ${parent?.name ?? main.name}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      ...path.map((node, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: node.name,
        item: `${SITE_URL}${categoryHref(node.slug)}`,
      })),
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="mx-auto max-w-[1440px] px-4 pt-5 xl:px-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          {path.map((node, i) => (
            <span key={node.id} className="flex items-center gap-1">
              <span aria-hidden>/</span>
              {i === path.length - 1 ? (
                <span className="text-foreground">{node.name}</span>
              ) : (
                <Link href={categoryHref(node.slug)} className="hover:text-foreground">{node.name}</Link>
              )}
            </span>
          ))}
        </nav>

        {category.bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={category.bannerImage} alt={category.name} className="mt-4 w-full rounded-xl object-cover" />
        ) : null}

        <div className="mt-3 flex items-center gap-3">
          {path.length === 1 ? (
            <CategoryArt slug={main.slug} image={main.image} name={main.name} className="h-12 w-12 shrink-0 rounded-full" />
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{category.name}</h1>
            {category.description ? <p className="mt-1 text-sm text-muted-foreground">{category.description}</p> : null}
          </div>
        </div>

        {category.children.length > 0 ? (
          <ul className="scrollbar-hide -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
            {category.children.map((child) => (
              <li key={child.id} className="shrink-0">
                <Link
                  href={categoryHref(child.slug)}
                  className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-card py-1.5 pl-1.5 pr-4 text-sm font-medium hover:border-brand hover:text-brand-strong"
                >
                  <CategoryArt slug={main.slug} image={child.image} name={child.name} className="h-7 w-7 rounded-full" />
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ProductFeed
        title={null}
        categoryId={category.id}
        subcategories={shallow(filterLinks)}
        categoryHeading={filterHeading}
      />
    </div>
  );
}
