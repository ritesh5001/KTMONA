"use client";

import * as React from "react";
import useSWR from "swr";
import { ChevronRight, Search } from "lucide-react";
import { browseCategories, type CategoryBrief } from "@/services/catalog";
import { cn } from "@/lib/utils";

const SWR_OPTS = { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 } as const;

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** One column: the children of `parentId` (or the top level), fetched when shown. */
function Column({
  parentId,
  admin,
  activeId,
  selectedId,
  onOpen,
}: {
  parentId: string | null;
  admin: boolean;
  activeId: string | undefined;
  selectedId: string | null;
  onOpen: (cat: CategoryBrief) => void;
}) {
  const { data, error, isLoading } = useSWR(["cat-children", admin, parentId ?? "root"], () => browseCategories({ parentId: parentId ?? "root" }, { admin }), SWR_OPTS);
  return (
    <ul className="max-h-72 min-w-[190px] overflow-y-auto border-r border-border-soft py-1 last:border-r-0">
      {isLoading ? (
        <li className="space-y-2 p-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-mist" />)}
        </li>
      ) : error ? (
        <li className="p-3 text-xs text-red-600">Could not load categories.</li>
      ) : (data?.categories ?? []).length === 0 ? (
        <li className="p-3 text-xs text-muted-foreground">Nothing here.</li>
      ) : (
        (data?.categories ?? []).map((cat) => {
          const active = activeId === cat.id || selectedId === cat.id;
          return (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => onOpen(cat)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                  active ? "bg-ink font-semibold text-paper" : "hover:bg-mist",
                  cat.isActive === false && "opacity-60"
                )}
              >
                <span className="truncate">{cat.name}{cat.isActive === false ? " (hidden)" : ""}</span>
                {cat.childCount > 0 ? <ChevronRight className="h-4 w-4 shrink-0 opacity-70" /> : null}
              </button>
            </li>
          );
        })
      )}
    </ul>
  );
}

/**
 * Pick a category without loading the whole tree: cascading columns that load
 * each level when opened (main → group → …), plus name search.
 *
 * `leafOnly` (default) lets only categories with no sub-categories be picked,
 * which is where products are listed. With it off, any category can be picked
 * by opening it and pressing "Use this category".
 */
export function LazyCategoryBrowser({
  value,
  onPick,
  leafOnly = true,
  admin = false,
  placeholder = "Try Sarees, Kurtis, Bangles, Toys and more...",
}: {
  value: string | null;
  onPick: (cat: CategoryBrief) => void;
  leafOnly?: boolean;
  admin?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = React.useState("");
  const q = useDebounced(query.trim());
  // Ids of the categories opened so far, one per column.
  const [open, setOpen] = React.useState<string[]>([]);
  const [opened, setOpened] = React.useState<CategoryBrief | null>(null);

  // Open the columns down to the current value.
  const current = useSWR(value ? ["cat-ids", admin, value] : null, () => browseCategories({ ids: [value!] }, { admin }), SWR_OPTS);
  const currentPathIds = current.data?.categories[0]?.pathIds;
  React.useEffect(() => {
    if (currentPathIds && currentPathIds.length > 1) setOpen(currentPathIds.slice(0, -1));
  }, [currentPathIds?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = useSWR(q.length >= 2 ? ["cat-search", admin, q] : null, () => browseCategories({ q }, { admin }), SWR_OPTS);
  const results = (search.data?.categories ?? []).filter((c) => !leafOnly || c.childCount === 0).slice(0, 30);

  const pick = (cat: CategoryBrief, depth: number) => {
    if (cat.childCount > 0) {
      setOpen([...open.slice(0, depth), cat.id]);
      setOpened(cat);
    } else {
      setOpen(open.slice(0, depth));
      setOpened(null);
      onPick(cat);
    }
  };

  const columnParents: (string | null)[] = [null, ...open];

  return (
    <div>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-border-soft bg-card pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>
      {q.length >= 2 ? (
        <ul className="mt-2 max-w-md overflow-hidden rounded-lg border border-border-soft bg-card shadow-sm">
          {search.isLoading ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No category found for &quot;{q}&quot;.</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(r);
                    setQuery("");
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-mist"
                >
                  <span className="font-medium">{r.name}</span>
                  {r.path && r.path.length > 1 ? <span className="block text-xs text-muted-foreground">in {r.path.slice(0, -1).join(" / ")}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      <div className="mt-4 flex max-w-full overflow-x-auto rounded-xl border border-border-soft bg-card">
        {columnParents.map((parentId, depth) => (
          <Column key={`${depth}:${parentId ?? "root"}`} parentId={parentId} admin={admin} activeId={open[depth]} selectedId={value} onOpen={(cat) => pick(cat, depth)} />
        ))}
      </div>

      {!leafOnly && opened ? (
        <button
          type="button"
          onClick={() => onPick(opened)}
          className="mt-3 inline-flex h-9 items-center rounded-lg border border-border-soft bg-card px-3 text-sm font-medium hover:bg-mist"
        >
          Use &quot;{opened.name}&quot;
        </button>
      ) : null}
    </div>
  );
}
