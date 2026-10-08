import type { Metadata } from "next";
import { Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { CategoryCarousel } from "@/components/home/CategoryCarousel";
import { OccasionSection } from "@/components/home/OccasionSection";
import { ProductShowcaseSection } from "@/components/home/ProductShowcaseSection";
import { HeroStaticServer } from "@/components/home/HeroStaticServer";
import { BestsellersStrip } from "@/components/home/BestsellersStrip";
import { WeddingSectionBanner } from "@/components/home/WeddingSectionBanner";
import { InfiniteProductShowcaseSection } from "@/components/home/InfiniteProductShowcaseSection";
import { NewArrivalsSection } from "@/components/home/NewArrivalsSection";
import { FeaturesMarquee } from "@/components/features-marquee";
import { SectionReveal } from "@/components/motion/SectionReveal";
import type { MarketplaceCardProduct } from "@/components/marketplace-product-card";
import type { CategoryListResponse } from "@/services/catalog";
import type { BestsellerProduct } from "@/services/bestsellers";
import type { Occasion } from "@/services/occasions";
import { BRAND_FULL_FORM, BRAND_TAGLINE, SITE_URL, SUPPORT_EMAIL, SUPPORT_PHONE_DIAL } from "@/lib/site-config";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const metadata: Metadata = {
  title: {
    absolute: "KTMONA | Trust Every Click | Shop from Verified Sellers in India",
  },
  description:
    "KTMONA is a trusted multi-vendor marketplace. Discover fashion, lifestyle and everyday products from verified Indian sellers, with secure PhonePe payments, easy returns and doorstep delivery.",
  keywords: [
    "KTMONA",
    "online marketplace india",
    "multi vendor marketplace",
    "buy from verified sellers",
    "online shopping india",
    "fashion and lifestyle online",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "KTMONA | Trust Every Click",
    description:
      "Discover fashion, lifestyle and everyday products from verified Indian sellers on KTMONA.",
    url: SITE_URL,
    siteName: "KTMONA",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "KTMONA - Trust Every Click",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KTMONA | Trust Every Click",
    description:
      "Discover fashion, lifestyle and everyday products from verified Indian sellers on KTMONA.",
    images: ["/og.png"],
  },
};

/* ── Organization JSON-LD ── */
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "KTMONA",
  alternateName: BRAND_FULL_FORM,
  slogan: BRAND_TAGLINE,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  email: SUPPORT_EMAIL,
  telephone: SUPPORT_PHONE_DIAL,
  address: {
    "@type": "PostalAddress",
    streetAddress: "A-740, Vinay Nagar, Agwanpur",
    addressLocality: "Faridabad",
    addressRegion: "Haryana",
    postalCode: "121013",
    addressCountry: "IN",
  },
};

/* ── FAQ JSON-LD ── */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is KTMONA?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "KTMONA (Knowledge, Trust & More Online Network Access) is a multi-vendor online marketplace where verified independent sellers across India list their products and customers shop with secure payments and tracked delivery."
      }
    },
    {
      "@type": "Question",
      name: "Are sellers on KTMONA verified?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Every seller is reviewed and approved by the KTMONA team, and every product is checked before it goes live on the marketplace."
      }
    },
    {
      "@type": "Question",
      name: "How do I pay on KTMONA?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can pay securely through PhonePe using UPI, cards or net banking. Every order gets a downloadable invoice."
      }
    },
    {
      "@type": "Question",
      name: "How can I start selling on KTMONA?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sign up as a seller with your mobile number, add your GST or non-GST details, PAN and bank account, then list your first product. Payouts are settled directly to your bank account."
      }
    }
  ]
};

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const HOME_REVALIDATE_SECONDS = 300;

async function fetchHomeData<T>(path: string, tags: string[]): Promise<T | null> {
  if (!API_URL) return null;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      next: { revalidate: HOME_REVALIDATE_SECONDS, tags },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function pickNewArrivals(products?: (MarketplaceCardProduct & { createdAt?: string })[]): MarketplaceCardProduct[] {
  if (!products?.length) return [];

  return products
    .slice()
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 2);
}

function TrustSection() {
  const trustItems = [
    {
      title: "Verified Sellers",
      titleShort: "Verified",
      desc: "Every seller is personally vetted",
      descShort: "Seller vetted",
      Icon: ShieldCheck,
    },
    {
      title: "Secure Payments",
      titleShort: "Payments",
      desc: "Safe & encrypted checkout",
      descShort: "Secure",
      Icon: Lock,
    },
    {
      title: "Hassle-Free Returns",
      titleShort: "Returns",
      desc: "10-day easy returns",
      descShort: "10-day",
      Icon: RotateCcw,
    },
  ];

  return (
    <section className="border-t border-border-soft bg-mist/50 dark:bg-card/50">
      <div className="mx-auto max-w-6xl px-6 py-4 sm:py-6">
        <div className="grid grid-cols-3 gap-3 text-center sm:gap-6">
          {trustItems.map((item) => (
            <div key={item.title} className="px-1">
              <div className="mb-1.5 flex justify-center text-brand-strong">
                <item.Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.8} />
              </div>
              <h4 className="mb-0.5 text-[11px] font-medium leading-tight text-foreground sm:text-sm">
                <span className="sm:hidden">{item.titleShort}</span>
                <span className="hidden sm:inline">{item.title}</span>
              </h4>
              <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                <span className="sm:hidden">{item.descShort}</span>
                <span className="hidden sm:inline">{item.desc}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  const [
    categories,
    bestsellers,
    kidsBestsellers,
    products,
    kidsProducts,
    occasions,
  ] = await Promise.all([
    fetchHomeData<CategoryListResponse>("/v1/categories", [CACHE_TAGS.categories]),
    fetchHomeData<{ products: BestsellerProduct[] }>("/v1/bestsellers?limit=4&audience=MENS", [CACHE_TAGS.products]),
    fetchHomeData<{ products: BestsellerProduct[] }>("/v1/bestsellers?limit=4&audience=KIDS", [CACHE_TAGS.products]),
    fetchHomeData<{ data: (MarketplaceCardProduct & { createdAt?: string })[] }>("/v1/products?limit=10&audience=MENS", [CACHE_TAGS.products]),
    fetchHomeData<{ data: (MarketplaceCardProduct & { createdAt?: string })[] }>("/v1/products?limit=10&audience=KIDS", [CACHE_TAGS.products]),
    fetchHomeData<{ occasions: Occasion[] }>("/v1/occasions", [CACHE_TAGS.occasions]),
  ]);

  const bestsellersProducts = bestsellers?.products ?? [];
  const kidsBestsellersProducts = kidsBestsellers?.products ?? [];
  const newArrivals = pickNewArrivals(products?.data);
  const kidsNewArrivals = pickNewArrivals(kidsProducts?.data);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="min-h-[calc(100vh-160px)] bg-background">
        <OccasionSection initialOccasions={occasions?.occasions} />
        <HeroStaticServer />
        <SectionReveal>
          <CategoryCarousel initialCategories={categories?.categories} />
        </SectionReveal>
        <SectionReveal delayMs={40}>
          <BestsellersStrip
            bestsellers={bestsellersProducts}
            kidsBestsellers={kidsBestsellersProducts}
          />
        </SectionReveal>
        <SectionReveal delayMs={60}>
          <ProductShowcaseSection
            initialProducts={products?.data}
            kidsProducts={kidsProducts?.data}
          />
        </SectionReveal>

        <SectionReveal>
          <WeddingSectionBanner />
        </SectionReveal>

        <SectionReveal delayMs={40}>
          <NewArrivalsSection
            mensProducts={newArrivals}
            kidsProducts={kidsNewArrivals}
          />
        </SectionReveal>
        <SectionReveal>
          <FeaturesMarquee />
        </SectionReveal>
        <SectionReveal delayMs={20}>
          <InfiniteProductShowcaseSection
            initialProducts={products?.data}
            kidsProducts={kidsProducts?.data}
          />
        </SectionReveal>
        <SectionReveal delayMs={60}>
          <TrustSection />
        </SectionReveal>
      </div>
    </>
  );
}
