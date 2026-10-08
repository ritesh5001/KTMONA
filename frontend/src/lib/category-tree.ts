/**
 * Builds the storefront category tree (main → group → leaf) from the flat
 * `/v1/categories` list, which carries `parentId` and `sortOrder`.
 */
export interface FlatCategory {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  sortOrder?: number | null;
  image?: string | null;
  bannerImage?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isActive?: boolean;
}

export interface CategoryNode extends FlatCategory {
  children: CategoryNode[];
  depth: number;
}

const bySortThenName = (a: FlatCategory, b: FlatCategory) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);

export function buildCategoryTree(
  flat: FlatCategory[] | null | undefined,
  { includeHidden = false }: { includeHidden?: boolean } = {},
): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const c of flat ?? []) {
    if (c.isActive === false && !includeHidden) continue;
    nodes.set(c.id, { ...c, children: [], depth: 0 });
  }
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else if (!node.parentId) roots.push(node);
    // A child whose parent is hidden is hidden with it.
  }
  const finish = (list: CategoryNode[], depth: number) => {
    list.sort(bySortThenName);
    for (const n of list) {
      n.depth = depth;
      finish(n.children, depth + 1);
    }
  };
  finish(roots, 0);
  return roots;
}

/** Every node in the tree, depth-first. */
export function flattenTree(roots: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = [];
  const walk = (list: CategoryNode[]) => list.forEach((n) => { out.push(n); walk(n.children); });
  walk(roots);
  return out;
}

export function findNode(roots: CategoryNode[], slug: string): CategoryNode | undefined {
  return flattenTree(roots).find((n) => n.slug === slug);
}

/** The chain from the main category down to (and including) `slug`. */
export function pathTo(roots: CategoryNode[], slug: string): CategoryNode[] {
  const search = (list: CategoryNode[], trail: CategoryNode[]): CategoryNode[] | null => {
    for (const n of list) {
      const next = [...trail, n];
      if (n.slug === slug) return next;
      const found = search(n.children, next);
      if (found) return found;
    }
    return null;
  };
  return search(roots, []) ?? [];
}

/** "Main › Group › Leaf" labels for every category, keyed by id. */
export function pathLabels(roots: CategoryNode[]): Map<string, string> {
  const labels = new Map<string, string>();
  const walk = (list: CategoryNode[], prefix: string) =>
    list.forEach((n) => {
      const label = prefix ? `${prefix} › ${n.name}` : n.name;
      labels.set(n.id, label);
      walk(n.children, label);
    });
  walk(roots, "");
  return labels;
}

export function categoryHref(slug: string): string {
  return `/collections/${slug}`;
}
