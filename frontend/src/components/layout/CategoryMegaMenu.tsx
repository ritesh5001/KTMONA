"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCategoryTree } from "@/hooks/use-category-tree";
import { categoryHref, type CategoryNode } from "@/lib/category-tree";
import { cn } from "@/lib/utils";

/**
 * Desktop category bar with a hover mega menu, in the style of Meesho's
 * header: one row of main categories; hovering one opens a panel listing its
 * groups (as headings) and their leaf categories.
 */
export function CategoryMegaMenu() {
  const { tree } = useCategoryTree();
  const pathname = usePathname();
  const [open, setOpen] = React.useState<string | null>(null);
  const closeTimer = React.useRef<number | null>(null);

  React.useEffect(() => setOpen(null), [pathname]);

  // Arrows appear when the 19 categories do not fit on one row.
  const rail = React.useRef<HTMLUListElement | null>(null);
  const [edges, setEdges] = React.useState({ left: false, right: false });
  const measure = React.useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  React.useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, tree.length]);
  const scrollBy = (dx: number) => rail.current?.scrollBy({ left: dx, behavior: "smooth" });

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(null), 120);
  };

  if (tree.length === 0) return <div className="hidden h-11 border-t border-border-soft lg:block" />;
  const active = tree.find((n) => n.id === open) ?? null;

  return (
    <div className="relative hidden border-t border-border-soft lg:block" onMouseLeave={scheduleClose} onMouseEnter={cancelClose}>
      <nav aria-label="Categories" className="relative mx-auto max-w-[1440px] px-4 xl:px-8">
        {edges.left ? (
          <button
            type="button"
            aria-label="Scroll categories left"
            onClick={() => scrollBy(-320)}
            className="absolute left-0 top-0 z-10 flex h-11 w-12 items-center justify-start bg-gradient-to-r from-background via-background to-transparent pl-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
        {edges.right ? (
          <button
            type="button"
            aria-label="Scroll categories right"
            onClick={() => scrollBy(320)}
            className="absolute right-0 top-0 z-10 flex h-11 w-12 items-center justify-end bg-gradient-to-l from-background via-background to-transparent pr-2"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
        <ul ref={rail} onScroll={measure} className="scrollbar-hide flex h-11 items-stretch gap-1 overflow-x-auto">
          {tree.map((main) => (
            <li key={main.id} className="flex shrink-0">
              <Link
                href={categoryHref(main.slug)}
                onMouseEnter={() => { cancelClose(); setOpen(main.id); }}
                onFocus={() => setOpen(main.id)}
                className={cn(
                  "flex items-center border-b-2 px-2.5 text-[13px] font-medium text-foreground/80 transition-colors hover:text-foreground xl:px-3 xl:text-sm",
                  open === main.id ? "border-brand text-foreground" : "border-transparent",
                )}
              >
                {main.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {active && active.children.length > 0 ? (
        <div
          className="absolute inset-x-0 top-full z-40 border-t border-border-soft bg-background shadow-[0_12px_24px_rgba(12,27,66,0.12)]"
          onMouseEnter={cancelClose}
        >
          <MegaPanel main={active} onNavigate={() => setOpen(null)} />
        </div>
      ) : null}
    </div>
  );
}

function MegaPanel({ main, onNavigate }: { main: CategoryNode; onNavigate: () => void }) {
  return (
    <div className="mx-auto max-h-[70vh] max-w-[1440px] overflow-y-auto px-4 xl:px-8">
      <div className="flex">
        {chunkColumns(main.children).map((column, ci) => (
          <div key={ci} className={cn("min-w-[200px] flex-1 space-y-5 px-5 py-5", ci % 2 === 1 && "bg-mist/60 dark:bg-card/60")}>
            {column.map((group) => (
              <div key={group.id}>
                <Link
                  href={categoryHref(group.slug)}
                  onClick={onNavigate}
                  className="mb-2 block text-sm font-semibold text-brand-strong hover:underline"
                >
                  {group.name}
                </Link>
                <ul className="space-y-1.5">
                  <li>
                    <Link href={categoryHref(group.slug)} onClick={onNavigate} className="text-[13px] text-muted-foreground hover:text-foreground">
                      All {group.name}
                    </Link>
                  </li>
                  {group.children.map((leaf) => (
                    <li key={leaf.id}>
                      <Link href={categoryHref(leaf.slug)} onClick={onNavigate} className="text-[13px] text-muted-foreground hover:text-foreground">
                        {leaf.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Splits groups, in order, over at most five columns of roughly even height
 * (a group's height is its leaf count plus its heading).
 */
function chunkColumns(groups: CategoryNode[]): CategoryNode[][] {
  const weight = (g: CategoryNode) => g.children.length + 3;
  const columns = Math.min(5, Math.max(1, groups.length));
  const target = groups.reduce((sum, g) => sum + weight(g), 0) / columns;
  const cols: CategoryNode[][] = [[]];
  let height = 0;
  groups.forEach((g, i) => {
    const remainingGroups = groups.length - i;
    const remainingCols = columns - cols.length;
    const current = cols[cols.length - 1]!;
    if (current.length > 0 && remainingCols > 0 && (height + weight(g) / 2 > target || remainingGroups <= remainingCols)) {
      cols.push([g]);
      height = weight(g);
    } else {
      current.push(g);
      height += weight(g);
    }
  });
  return cols;
}
