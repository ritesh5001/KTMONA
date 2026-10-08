import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/services/catalog";

const ARCH_RADIUS = "50% 50% 0 0 / 40% 40% 0 0";
const ARC_BORDER_WIDTH = 3.1;

type CategoryItem = Category & {
  image?: string | null;
  imageUrl?: string | null;
};

function resolveCategoryImage(category: CategoryItem): string {
  const raw = category.imageUrl ?? category.image ?? "";
  if (!raw) return "/images/product-placeholder.svg";
  if (raw.startsWith("/") || raw.startsWith("https://ik.imagekit.io")) return raw;
  return "/images/product-placeholder.svg";
}

function slugifyCategory(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CategoryCarousel({ initialCategories }: { initialCategories?: CategoryItem[] }) {
  const categories = (initialCategories ?? []).filter((category) => category.isActive);

  return (
    <section id="categories" className="border-t border-border-soft bg-mist dark:bg-card">
      <div className="mx-auto max-w-460 px-3 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="mb-6 text-center">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.34em] text-brand-strong dark:text-brand-strong">
            Shop by Category
          </p>
          <h2 className="font-serif text-3xl font-light tracking-[0.02em] text-foreground dark:text-foreground sm:text-4xl">
            Curated Collections
          </h2>
        </div>

        {categories.length === 0 ? (
          <div className="rounded border border-border-soft bg-white/70 px-6 py-10 text-center text-sm text-muted-foreground dark:border-border dark:bg-navy/20 dark:text-muted-foreground">
            Categories will be available soon.
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="flex gap-3 px-1 md:gap-4 lg:gap-6">
              {categories.map((category) => {
                const categorySlug = category.slug || slugifyCategory(category.name);
                return (
                  <Link
                    key={category.id}
                    href={`/marketplace?category=${encodeURIComponent(categorySlug)}`}
                    className="group block shrink-0 w-[calc(50%-6px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-18px)]"
                  >
                    <div
                      className="relative w-full"
                      style={{
                        aspectRatio: "3 / 4",
                        borderRadius: ARCH_RADIUS,
                        padding: `${ARC_BORDER_WIDTH}px`,
                        background: "linear-gradient(to bottom, #DDE5F4, #5A6FA8 40%, #0C1B42)",
                      }}
                    >
                      <div
                        className="relative h-full w-full overflow-hidden bg-mist dark:bg-navy/20"
                        style={{ borderRadius: ARCH_RADIUS }}
                      >
                        <Image
                          src={resolveCategoryImage(category)}
                          alt={category.name}
                          fill
                          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          quality={75}
                          loading="lazy"
                          draggable={false}
                          className="object-cover transition-transform duration-400 ease-out group-hover:scale-105"
                          style={{ objectPosition: "center 20%" }}
                        />

                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background:
                              "linear-gradient(to top, rgba(40,14,4,0.82) 0%, rgba(40,14,4,0.4) 18%, rgba(40,14,4,0.06) 36%, transparent 55%)",
                          }}
                        />

                        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center px-3 pb-4 pt-16 sm:px-5 sm:pb-5 lg:pb-7">
                          <h3 className="text-center font-serif text-sm font-normal uppercase tracking-widest leading-snug text-white dark:text-paper drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)] sm:text-xl lg:text-2xl">
                            {category.name}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 border-b border-transparent pb-1 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground dark:text-muted-foreground transition-colors duration-300 hover:border-brand dark:hover:border-brand hover:text-foreground dark:hover:text-foreground"
          >
            View All Categories
            <span className="text-brand-strong">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
