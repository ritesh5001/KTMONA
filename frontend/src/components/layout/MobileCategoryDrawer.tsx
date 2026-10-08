"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useCategoryTree } from "@/hooks/use-category-tree";
import { categoryHref } from "@/lib/category-tree";
import { CategoryArt } from "@/components/storefront/category-visuals";
import { cn } from "@/lib/utils";

/**
 * Slide-in menu for phones: every main category opens to its groups, and each
 * group to its leaves, like Meesho's app drawer.
 */
export function MobileCategoryDrawer({
  open,
  onClose,
  accountLinks,
}: {
  open: boolean;
  onClose: () => void;
  accountLinks: Array<{ href: string; label: string; onClick?: () => void }>;
}) {
  const { tree } = useCategoryTree();
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = React.useState<string | null>(null);

  React.useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div className={cn("absolute inset-0 bg-ink/50 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Shop by category"
        className={cn(
          "absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-background shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border-soft px-4">
          <p className="text-base font-semibold">Shop by category</p>
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-full p-2 hover:bg-mist">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ul>
            {tree.map((main) => {
              const isOpen = expanded === main.id;
              return (
                <li key={main.id} className="border-b border-border-soft">
                  <button
                    type="button"
                    onClick={() => { setExpanded(isOpen ? null : main.id); setExpandedGroup(null); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <CategoryArt slug={main.slug} image={main.image} name={main.name} className="h-10 w-10 shrink-0 rounded-full" />
                    <span className="flex-1 text-sm font-medium">{main.name}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen ? (
                    <ul className="bg-mist/50 pb-2 dark:bg-card/50">
                      <li>
                        <Link href={categoryHref(main.slug)} className="block px-6 py-2.5 text-sm font-semibold text-brand-strong">
                          View all {main.name}
                        </Link>
                      </li>
                      {main.children.map((group) => {
                        const groupOpen = expandedGroup === group.id;
                        return (
                          <li key={group.id}>
                            <button
                              type="button"
                              onClick={() => setExpandedGroup(groupOpen ? null : group.id)}
                              className="flex w-full items-center justify-between px-6 py-2.5 text-left text-sm"
                              aria-expanded={groupOpen}
                            >
                              {group.name}
                              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", groupOpen && "rotate-90")} />
                            </button>
                            {groupOpen ? (
                              <ul className="pb-1">
                                <li><Link href={categoryHref(group.slug)} className="block px-9 py-2 text-[13px] font-medium text-brand-strong">All {group.name}</Link></li>
                                {group.children.map((leaf) => (
                                  <li key={leaf.id}>
                                    <Link href={categoryHref(leaf.slug)} className="block px-9 py-2 text-[13px] text-muted-foreground">{leaf.name}</Link>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="space-y-1 p-4">
            {accountLinks.map((l) =>
              l.onClick ? (
                <button key={l.label} type="button" onClick={l.onClick} className="block w-full py-2 text-left text-sm font-medium">{l.label}</button>
              ) : (
                <Link key={l.label} href={l.href} className="block py-2 text-sm font-medium">{l.label}</Link>
              ),
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
