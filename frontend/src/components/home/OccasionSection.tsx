import Image from "next/image";
import Link from "next/link";
import type { Occasion } from "@/services/occasions";

function resolveOccasionImage(occasion: Occasion): string {
  const raw = occasion.image ?? "";
  if (!raw) return "/images/product-placeholder.svg";
  if (raw.startsWith("/") || raw.startsWith("https://ik.imagekit.io")) return raw;
  return "/images/product-placeholder.svg";
}

function OccasionCard({ occasion, mode = "carousel" }: { occasion: Occasion; mode?: "carousel" | "grid" }) {
  const isGrid = mode === "grid";

  return (
    <div className="group w-full">
      <div
        className={
          isGrid
            ? "relative aspect-4/5 w-full overflow-hidden border border-border-soft bg-card transition-all duration-300 group-hover:border-brand dark:border-border dark:bg-navy/20 dark:group-hover:border-brand"
            : "relative aspect-3/4 w-full overflow-hidden border border-border-soft bg-card transition-all duration-300 group-hover:border-brand dark:border-border dark:bg-navy/20 dark:group-hover:border-brand"
        }
      >
        {isGrid ? (
          <Image
            src={resolveOccasionImage(occasion)}
            alt={occasion.name}
            fill
            sizes="(max-width: 767px) 20vw, (max-width: 1023px) 14vw, 10vw"
            quality={75}
            loading="lazy"
            draggable={false}
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            style={{ objectPosition: "center 20%" }}
          />
        ) : (
          <>
            <div className="relative h-[76%] w-full overflow-hidden">
              <Image
                src={resolveOccasionImage(occasion)}
                alt={occasion.name}
                fill
                sizes="(max-width: 767px) 20vw, (max-width: 1023px) 14vw, 10vw"
                quality={75}
                loading="lazy"
                draggable={false}
                className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                style={{ objectPosition: "center 20%" }}
              />
            </div>
            <div className="flex h-[24%] items-center justify-center border-t border-border-soft bg-mist px-1 dark:border-border dark:bg-navy/50">
              <span className="truncate text-[9px] font-medium uppercase tracking-[0.11em] text-ink dark:text-paper sm:text-[10px]">
                {occasion.name}
              </span>
            </div>
          </>
        )}
      </div>
      {isGrid && (
        <h3 className="mt-2 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-ink dark:text-paper">
          {occasion.name}
        </h3>
      )}
    </div>
  );
}

export function OccasionSection({ initialOccasions }: { initialOccasions?: Occasion[] }) {
  const occasions = (initialOccasions ?? []).filter((occasion) => occasion.isActive);

  if (occasions.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-border-soft bg-mist dark:bg-card">
      <div className="mx-auto max-w-360 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mx-auto max-w-330 overflow-x-auto lg:hidden" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="flex gap-2 px-1 py-1 md:gap-3">
            {occasions.map((occasion) => (
              <Link
                key={occasion.id}
                href={`/marketplace?occasion=${occasion.slug}`}
                className="block shrink-0 w-[calc((100%-2rem)/5)] md:w-[calc((100%-4.5rem)/7)]"
              >
                <OccasionCard occasion={occasion} />
              </Link>
            ))}
          </div>
        </div>

        <div className="mx-auto hidden max-w-330 flex-wrap justify-center gap-4 px-12 lg:flex">
          {occasions.map((occasion) => (
            <Link key={occasion.id} href={`/marketplace?occasion=${occasion.slug}`} className="block w-26">
              <OccasionCard occasion={occasion} mode="grid" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
