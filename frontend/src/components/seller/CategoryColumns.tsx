"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { FolderPlus } from "lucide-react";
import { browseCategories } from "@/services/catalog";
import { LazyCategoryBrowser } from "@/components/category/LazyCategoryBrowser";

export interface CategoryPathNode {
  id: string;
  name: string;
  image?: string | null;
}

/**
 * The chain from the main category down to `categoryId`, fetched on demand
 * (the full category tree is too big to load). Empty until it arrives.
 */
export function useCategoryPath(categoryId: string | null | undefined) {
  const { data, error, isLoading } = useSWR(
    categoryId ? ["cat-ids", false, categoryId] : null,
    () => browseCategories({ ids: [categoryId!] }),
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 }
  );
  const category = data?.categories[0] ?? null;
  const path = React.useMemo<CategoryPathNode[]>(
    () => (category?.pathIds ?? []).map((id, i) => ({ id, name: category!.path?.[i] ?? "", image: id === category!.id ? category!.image : null })),
    [category]
  );
  return { path, category, error, isLoading };
}

export function categoryPathLabel(path: Array<{ name: string }> | undefined) {
  return path?.map((n) => n.name).join(" / ") ?? "";
}

/**
 * Meesho "Select Category": search box plus cascading columns
 * (main → group → leaf), each level loaded when opened. Only leaf
 * categories can be picked.
 */
export function CategoryColumns({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Search Category</p>
        <Link href="/seller/category-requests?new=1" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-strong hover:underline">
          <FolderPlus className="h-4 w-4" /> Can&apos;t find your category? Request a new one
        </Link>
      </div>
      <LazyCategoryBrowser value={value} onPick={(cat) => onChange(cat.id)} />
    </div>
  );
}
