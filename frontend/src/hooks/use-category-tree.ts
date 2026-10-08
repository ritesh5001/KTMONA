"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { getCategories, type Category } from "@/services/catalog";
import { buildCategoryTree, type CategoryNode } from "@/lib/category-tree";

/** The storefront category tree, shared by the header menus and listings. */
export function useCategoryTree(initial?: Category[] | null): { tree: CategoryNode[]; loading: boolean } {
  const { data, isLoading } = useSWR("storefront-categories", () => getCategories(), {
    fallbackData: initial ? { categories: initial } : undefined,
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60_000,
  });
  const tree = useMemo(() => buildCategoryTree(data?.categories), [data]);
  return { tree, loading: isLoading && !data };
}
