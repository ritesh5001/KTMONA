import { ProductFeed } from "@/components/storefront/ProductFeed";
import type { CategoryNode } from "@/lib/category-tree";

/** The homepage "Products For You" feed, filtered by main category links. */
export function HomeProductFeed({ mains }: { mains: CategoryNode[] }) {
  // Only the main categories are listed in the filter; drop their subtrees so
  // the client payload stays small.
  const links = mains.map(({ children: _children, ...main }) => ({ ...main, children: [] }));
  return <ProductFeed title="Products For You" subcategories={links} />;
}
