"use client";

import * as React from "react";
import useSWR from "swr";
import { ChevronRight, Search } from "lucide-react";
import { getCategories } from "@/services/catalog";
import { buildCategoryTree, type CategoryNode } from "@/lib/category-tree";
import { cn } from "@/lib/utils";

export function useCategoryTree() {
  const { data, error, isLoading } = useSWR("categories-all", () => getCategories(), { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 });
  const tree = React.useMemo(
    () => buildCategoryTree((data?.categories ?? []).filter((c) => c.isActive !== false).map((c) => ({ ...c, slug: c.slug ?? c.id }))),
    [data]
  );
  const byId = React.useMemo(() => {
    const map = new Map<string, { node: CategoryNode; path: CategoryNode[] }>();
    const walk = (nodes: CategoryNode[], path: CategoryNode[]) =>
      nodes.forEach((n) => {
        map.set(n.id, { node: n, path: [...path, n] });
        walk(n.children, [...path, n]);
      });
    walk(tree, []);
    return map;
  }, [tree]);
  return { tree, byId, error, isLoading };
}

export function categoryPathLabel(path: CategoryNode[] | undefined) {
  return path?.map((n) => n.name).join(" / ") ?? "";
}

/**
 * Meesho "Select Category": search box plus cascading columns
 * (main → group → leaf). Only leaf categories can be picked.
 */
export function CategoryColumns({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { tree, byId, isLoading } = useCategoryTree();
  const [query, setQuery] = React.useState("");
  const selectedPath = value ? (byId.get(value)?.path ?? []) : [];
  const [open, setOpen] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (selectedPath.length) setOpen(selectedPath.slice(0, -1).map((n) => n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, byId]);

  const leaves = React.useMemo(() => [...byId.values()].filter((e) => e.node.children.length === 0), [byId]);
  const results = query.trim().length >= 2 ? leaves.filter((e) => e.path.some((n) => n.name.toLowerCase().includes(query.trim().toLowerCase()))).slice(0, 30) : [];

  const columns: CategoryNode[][] = [tree];
  open.forEach((id) => {
    const node = byId.get(id)?.node;
    if (node?.children.length) columns.push(node.children);
  });

  const pick = (node: CategoryNode, depth: number) => {
    if (node.children.length) setOpen([...open.slice(0, depth), node.id]);
    else {
      setOpen(open.slice(0, depth));
      onChange(node.id);
    }
  };

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Search Category</p>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try Sarees, Kurtis, Bangles, Toys and more..."
          className="h-10 w-full rounded-lg border border-border-soft bg-card pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>
      {results.length ? (
        <ul className="mt-2 max-w-md overflow-hidden rounded-lg border border-border-soft bg-card shadow-sm">
          {results.map((r) => (
            <li key={r.node.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(r.node.id);
                  setQuery("");
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-mist"
              >
                <span className="font-medium">{r.node.name}</span>
                <span className="block text-xs text-muted-foreground">in {r.path.slice(0, -1).map((n) => n.name).join(" / ")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex max-w-full overflow-x-auto rounded-xl border border-border-soft bg-card">
        {isLoading ? <div className="h-64 w-full animate-pulse bg-mist" /> : null}
        {columns.map((col, depth) => (
          <ul key={depth} className="max-h-72 min-w-[190px] overflow-y-auto border-r border-border-soft py-1 last:border-r-0">
            {col.map((node) => {
              const active = open[depth] === node.id || value === node.id;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => pick(node, depth)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                      active ? "bg-ink font-semibold text-paper dark:bg-brand dark:text-ink" : "hover:bg-mist"
                    )}
                  >
                    <span className="truncate">{node.name}</span>
                    {node.children.length ? <ChevronRight className="h-4 w-4 shrink-0 opacity-70" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}
