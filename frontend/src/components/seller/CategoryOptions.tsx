import * as React from "react";
import { buildCategoryTree } from "@/lib/category-tree";

type Cat = { id: string; name: string; slug?: string; parentId?: string | null; sortOrder?: number | null; isActive?: boolean };

/**
 * `<option>`s for a category `<select>`, grouped as "Main › Group" with the
 * leaf categories underneath, so a seller lists a product in a specific leaf.
 * Falls back to a plain list when the categories have no hierarchy.
 */
export function CategoryOptions({ categories, value }: { categories: Cat[]; value?: string }) {
  const tree = React.useMemo(
    () => buildCategoryTree(categories.map((c) => ({ ...c, slug: c.slug ?? c.id }))),
    [categories],
  );
  const hierarchical = tree.some((n) => n.children.length > 0);
  if (!hierarchical) {
    return <>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</>;
  }

  const leafIds = new Set<string>();
  const groups: Array<{ label: string; items: Cat[] }> = [];
  for (const main of tree) {
    if (main.children.length === 0) {
      groups.push({ label: main.name, items: [main] });
      leafIds.add(main.id);
      continue;
    }
    for (const group of main.children) {
      const items = group.children.length > 0 ? group.children : [group];
      items.forEach((i) => leafIds.add(i.id));
      groups.push({ label: `${main.name} › ${group.name}`, items });
    }
  }
  // Keep a product's current category selectable even if it is not a leaf.
  const current = value && !leafIds.has(value) ? categories.find((c) => c.id === value) : undefined;

  return (
    <>
      {current ? <option value={current.id}>{current.name} (current)</option> : null}
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      ))}
    </>
  );
}
