"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CategoryArt, defaultBannerImage } from "@/components/storefront/category-visuals";
import { cn } from "@/lib/utils";

export interface HomeBanner {
  imageUrl: string;
  mobileImageUrl?: string | null;
  href?: string | null;
  alt: string;
}

/**
 * Homepage hero carousel. Shows the banners uploaded in Admin → Homepage when
 * there are any; until then, the built-in KTMONA designs below.
 */
export function HomeHero({ banners }: { banners: HomeBanner[] }) {
  const slides: React.ReactNode[] =
    banners.length > 0 ? banners.map((b, i) => <ImageSlide key={i} banner={b} priority={i === 0} />) : BUILT_IN_SLIDES;
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const count = slides.length;

  React.useEffect(() => {
    if (paused || count < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => window.clearInterval(t);
  }, [paused, count]);

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Offers"
    >
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => (
          <div key={i} className="w-full shrink-0" aria-hidden={i !== index} aria-roledescription="slide">
            {slide}
          </div>
        ))}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
            className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/85 p-2 text-ink shadow hover:bg-white md:block"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => setIndex((i) => (i + 1) % count)}
            className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/85 p-2 text-ink shadow hover:bg-white md:block"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show banner ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn("h-1.5 rounded-full transition-all", i === index ? "w-6 bg-white" : "w-1.5 bg-white/55")}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function ImageSlide({ banner, priority }: { banner: HomeBanner; priority: boolean }) {
  const img = (
    <picture>
      {banner.mobileImageUrl ? <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl} /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={banner.imageUrl}
        alt={banner.alt}
        className="block aspect-[16/9] w-full object-cover md:aspect-[1440/400]"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
      />
    </picture>
  );
  return banner.href ? <Link href={banner.href}>{img}</Link> : img;
}

/* ── Built-in banners (replace from Admin → Homepage) ─────────────────────── */

function DesignedSlide({
  gradient,
  photo,
  eyebrow,
  title,
  subtitle,
  cta,
  href,
  tiles,
  dark = true,
}: {
  gradient: string;
  /** Built-in banner photo key; the tiles show instead when it is missing. */
  photo: string;
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  cta: string;
  href: string;
  tiles: Array<{ slug: string; label: string }>;
  dark?: boolean;
}) {
  const src = defaultBannerImage(photo);
  return (
    <Link href={href} className={cn("relative block overflow-hidden", gradient)}>
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-y-0 right-0 h-full w-[72%] object-cover object-[70%_18%] [mask-image:linear-gradient(to_right,transparent,black_45%)] md:w-[62%]"
            fetchPriority={photo === "hero-smart" ? "high" : "auto"}
            decoding="async"
          />
        </>
      ) : null}
      <div className="relative mx-auto flex min-h-[220px] max-w-[1440px] items-center gap-6 px-6 py-8 sm:min-h-[300px] md:min-h-[380px] md:px-12">
        <div className={cn("max-w-[60%] flex-1 sm:max-w-md", dark ? "text-white" : "text-ink")}>
          <p className={cn("text-xs font-semibold uppercase tracking-[0.2em] ktm-keep-case", dark ? "text-brand-light" : "text-brand-dark")}>{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-4xl md:text-5xl">{title}</h2>
          <p className={cn("mt-3 hidden text-sm sm:block sm:text-base", dark ? "text-white/80" : "text-ink/75")}>{subtitle}</p>
          <span className={cn("mt-5 inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold sm:h-11 sm:px-6", dark ? "bg-white text-ink" : "bg-ink text-white")}>{cta}</span>
        </div>
        {src ? null : (
          <div className="hidden flex-1 justify-end gap-3 sm:flex">
            {tiles.map((t, i) => (
              <div key={t.slug} className={cn("w-[22%] max-w-[150px]", i % 2 === 1 && "mt-10")}>
                <CategoryArt slug={t.slug} name={t.label} className="aspect-[3/4] rounded-t-full border-4 border-white/80 shadow-lg" />
                <p className={cn("mt-2 text-center text-sm font-semibold", dark ? "text-white" : "text-ink")}>{t.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

const BUILT_IN_SLIDES: React.ReactNode[] = [
  <DesignedSlide
    key="smart"
    gradient="bg-[linear-gradient(110deg,#0C1B42_0%,#1F2F7A_55%,#6B2A86_100%)]"
    photo="hero-smart"
    eyebrow="Trust every click"
    title={<>Smart Shopping,<br />Verified Sellers</>}
    subtitle="Fashion, home, beauty, electronics and more from sellers across India."
    cta="Shop Now"
    href="/marketplace"
    tiles={[
      { slug: "kurti-saree", label: "Ethnic" },
      { slug: "women-western", label: "Western" },
      { slug: "men", label: "Men" },
      { slug: "home-kitchen", label: "Home" },
    ]}
  />,
  <DesignedSlide
    key="ethnic"
    gradient="bg-[linear-gradient(110deg,#FF8A00_0%,#FFAA02_60%,#FFD27A_100%)]"
    photo="hero-ethnic"
    dark={false}
    eyebrow="Festive edit"
    title={<>Sarees, Kurtis<br />& Kurta Sets</>}
    subtitle="Silk, cotton and georgette picks for every festival and family function."
    cta="Explore Ethnic Wear"
    href="/collections/kurti-saree"
    tiles={[
      { slug: "kurti-saree", label: "Sarees" },
      { slug: "jewellery-accessories", label: "Jewellery" },
      { slug: "bags-footwear", label: "Footwear" },
      { slug: "beauty-health", label: "Beauty" },
    ]}
  />,
  <DesignedSlide
    key="gadgets"
    gradient="bg-[linear-gradient(110deg,#0B3B5C_0%,#0E6E8C_60%,#22A6B3_100%)]"
    photo="hero-gadgets"
    eyebrow="Gadgets & appliances"
    title={<>Electronics,<br />Watches & More</>}
    subtitle="Earbuds, chargers, smartwatches and everyday appliances."
    cta="Shop Electronics"
    href="/collections/electronics"
    tiles={[
      { slug: "electronics", label: "Audio" },
      { slug: "watches", label: "Watches" },
      { slug: "electricals", label: "Appliances" },
      { slug: "car-motorbike", label: "Auto" },
    ]}
  />,
];
