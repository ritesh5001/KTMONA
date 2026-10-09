import Link from "next/link";
import { BadgeCheck, RotateCcw, ShieldCheck, Store } from "lucide-react";
import { CategoryArt, defaultBannerImage, defaultCategoryImage } from "@/components/storefront/category-visuals";
import { categoryHref, findNode, type CategoryNode } from "@/lib/category-tree";
import type { HomeBanner } from "@/components/home/HomeHero";

/* ── Trust strip under the hero ───────────────────────────────────────────── */

export function TrustStrip() {
  const items = [
    { icon: RotateCcw, label: "Easy Returns" },
    { icon: ShieldCheck, label: "Secure Payments" },
    { icon: BadgeCheck, label: "Verified Sellers" },
  ];
  return (
    <div className="bg-mist/70 px-4 py-3 dark:bg-card/60">
      <div className="mx-auto flex max-w-3xl items-center justify-center divide-x divide-border-soft rounded-lg border border-border-soft bg-background py-2.5">
        {items.map(({ icon: Icon, label }) => (
          <p key={label} className="flex flex-1 items-center justify-center gap-2 px-2 text-xs font-medium text-foreground/80 sm:text-sm">
            <Icon className="h-4 w-4 text-brand-strong" aria-hidden /> {label}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ── Main category tiles (Meesho's arch row) ──────────────────────────────── */

export function CategoryArches({ tree }: { tree: CategoryNode[] }) {
  if (tree.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-6 xl:px-8">
      <ul className="scrollbar-hide -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] md:gap-x-4 md:gap-y-6 md:overflow-visible md:px-0">
        {tree.map((c) => (
          <li key={c.id} className="w-20 shrink-0 md:w-auto">
            <Link href={categoryHref(c.slug)} className="group block text-center">
              <CategoryArt
                slug={c.slug}
                image={c.image}
                name={c.name}
                className="mx-auto aspect-[5/6] w-full max-w-[120px] rounded-t-full transition-transform group-hover:-translate-y-1"
              />
              <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground/85 sm:text-[13px]">{c.name}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Festive promo band (dark banner with four arch tiles) ────────────────── */

const FESTIVE_TILES = [
  { slug: "sarees", label: "Sarees", art: "sarees" },
  { slug: "kurtis", label: "Kurtis", art: "kurtis" },
  { slug: "ethnic-wear", label: "Men Ethnic", art: "men" },
  { slug: "women-jewellery", label: "Jewellery", art: "jewellery-accessories" },
];

export function FestivePromo({ tree, banner }: { tree: CategoryNode[]; banner: HomeBanner | null }) {
  if (banner) {
    const img = (
      <picture>
        {banner.mobileImageUrl ? <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl} /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={banner.imageUrl} alt={banner.alt} className="block w-full object-cover" loading="lazy" />
      </picture>
    );
    return <section className="py-4">{banner.href ? <Link href={banner.href}>{img}</Link> : img}</section>;
  }
  const tiles = FESTIVE_TILES.filter((t) => findNode(tree, t.slug));
  const photo = defaultBannerImage("promo-festive");
  return (
    <section className="relative my-4 overflow-hidden bg-[radial-gradient(circle_at_20%_30%,#5B3A1E_0%,#2E1D10_70%)] text-white">
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" aria-hidden className="block aspect-[3/2] w-full object-cover md:absolute md:inset-0 md:aspect-auto md:h-full md:object-[75%_center]" loading="lazy" decoding="async" />
          <div className="absolute inset-0 hidden bg-gradient-to-r from-[#2E1D10] via-[#2E1D10]/85 to-transparent md:block" />
        </>
      ) : null}
      <div className="relative mx-auto grid max-w-[1440px] items-center gap-8 px-6 py-10 md:grid-cols-2 md:px-12 md:py-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#F5C76B] ktm-keep-case">KTMONA Festive</p>
          <h2 className="mt-2 text-4xl font-bold text-[#F5D58A] sm:text-5xl">Wedding & Festive Edit</h2>
          <p className="mt-3 max-w-md text-white/80">Products you love, from sellers we verify. Sarees, lehengas, sherwanis and jewellery for the season.</p>
          <Link href="/collections/kurti-saree" className="mt-6 inline-flex h-11 items-center rounded-md border border-[#F5C76B] px-6 text-sm font-semibold text-[#F5D58A] hover:bg-white/10">
            Shop Now
          </Link>
          <div className="mt-8 grid max-w-md grid-cols-4 gap-3">
            {tiles.map((t) => (
              <Link key={t.slug} href={categoryHref(t.slug)} className="group relative block">
                <CategoryArt slug={t.art} name={t.label} className="aspect-[4/5] rounded-t-full border-2 border-[#F5C76B]/70 transition-transform group-hover:-translate-y-1" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1 pb-1.5 pt-5 text-center text-[11px] font-semibold text-white sm:text-xs">
                  {t.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Popular subcategories (Meesho's "Original Brands" cards) ─────────────── */

const SHOWCASE = [
  "kurtis", "sarees", "top-wear", "topwear", "women-footwear", "audio", "makeup",
  "kitchen-and-dining", "toys-and-games", "smart-watches", "women-bags", "fitness",
];

const SHOWCASE_LABELS: Record<string, string> = { "top-wear": "Men Topwear", topwear: "Women Topwear", audio: "Audio & Earbuds" };

export function ShopByCategory({ tree }: { tree: CategoryNode[] }) {
  const items = SHOWCASE.map((slug) => {
    const node = findNode(tree, slug);
    if (!node) return null;
    const main = tree.find((m) => m.children.some((g) => g.id === node.id)) ?? null;
    return { node, main };
  }).filter((x): x is { node: CategoryNode; main: CategoryNode | null } => x !== null);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-8 xl:px-8">
      <div className="mb-5 flex items-end justify-between">
        <h2 className="text-xl font-semibold sm:text-2xl">Popular Categories</h2>
        <Link href="/categories" className="text-sm font-semibold text-brand-strong hover:underline">VIEW ALL ›</Link>
      </div>
      <ul className="scrollbar-hide -mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
        {items.map(({ node, main }) => (
          <li key={node.id} className="w-40 shrink-0 sm:w-44">
            <Link href={categoryHref(node.slug)} className="group block overflow-hidden rounded-xl border border-border-soft bg-card shadow-sm transition-shadow hover:shadow-md">
              <CategoryArt
                slug={main?.slug ?? node.slug}
                image={node.image ?? defaultCategoryImage(node.slug)}
                name={node.name}
                className="aspect-square rounded-b-[40%_18%]"
                iconClassName="transition-transform group-hover:scale-110"
              />
              <p className="bg-ink px-2 py-2.5 text-center text-sm font-semibold text-white">
                {SHOWCASE_LABELS[node.slug] ?? node.name}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Offer band: seller sign-up on the left, four shop tiles on the right ── */

const OFFER_TILES = [
  { slug: "grocery", label: "Daily Essentials" },
  { slug: "home-kitchen", label: "Home Makeover" },
  { slug: "electronics", label: "Top Gadgets" },
  { slug: "sports-fitness", label: "Get Fit" },
];

export function SellerOfferBand() {
  return (
    <section className="my-4 grid md:grid-cols-[minmax(260px,30%)_1fr]">
      <div className="flex flex-col justify-center bg-brand px-8 py-8 text-ink">
        <p className="text-3xl font-bold leading-tight sm:text-4xl">Sell on KTMONA</p>
        <p className="mt-2 text-sm font-medium sm:text-base">Reach shoppers across India. Register with your GST or PAN and start listing today.</p>
        <Link href="/register/seller" className="mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-md bg-white px-6 text-sm font-semibold text-ink shadow hover:bg-paper">
          <Store className="h-4 w-4" /> Become a Seller
        </Link>
      </div>
      <div className="bg-[linear-gradient(110deg,#1A2A6C_0%,#3B2A86_100%)] px-4 py-8 sm:px-8">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {OFFER_TILES.map((t) => (
            <li key={t.slug}>
              <Link href={categoryHref(t.slug)} className="group block">
                <CategoryArt slug={t.slug} name={t.label} className="aspect-[4/5] rounded-2xl border-4 border-brand-light shadow-lg transition-transform group-hover:-translate-y-1" />
                <span className="relative mx-auto -mt-4 block w-fit rounded-md border border-brand-light bg-white px-3 py-1 text-xs font-semibold text-ink shadow sm:text-sm">
                  {t.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── "More about KTMONA" with the full category directory ────────────────── */

export function MoreAbout({ tree }: { tree: CategoryNode[] }) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-10 xl:px-8">
      <details className="group rounded-lg border border-border-soft bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold">
          More About KTMONA
          <span className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="space-y-6 border-t border-border-soft px-5 py-5 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p>
              KTMONA is an online marketplace where verified sellers from across India list fashion, home, beauty,
              electronics and everyday products. Every seller is reviewed before they can sell, and every listing is
              checked before it goes live.
            </p>
            <p>
              Shop sarees, kurtis, western wear, menswear, kids clothing and toys, home and kitchen products, beauty and
              wellness, jewellery, bags and footwear, gadgets and more, with secure payments and easy returns.
            </p>
          </div>
          {tree.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {tree.map((main) => (
                <div key={main.id}>
                  <Link href={categoryHref(main.slug)} className="font-semibold text-foreground hover:text-brand-strong">{main.name}</Link>
                  <p className="mt-1 leading-relaxed">
                    {main.children.map((g, i) => (
                      <span key={g.id}>
                        {i > 0 ? " · " : ""}
                        <Link href={categoryHref(g.slug)} className="hover:text-foreground">{g.name}</Link>
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
