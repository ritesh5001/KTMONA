import type { Metadata } from "next";
import { HomeHero, type HomeBanner } from "@/components/home/HomeHero";
import {
  CategoryArches,
  FestivePromo,
  MoreAbout,
  SellerOfferBand,
  ShopByCategory,
  TrustStrip,
} from "@/components/home/HomeSections";
import { HomeProductFeed } from "@/components/home/HomeProductFeed";
import { PriceLockBand } from "@/components/home/PriceLockBand";
import type { CategoryListResponse } from "@/services/catalog";
import { buildCategoryTree } from "@/lib/category-tree";
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

export default async function Home() {
  const [categories, banners] = await Promise.all([
    fetchHomeData<CategoryListResponse>("/v1/categories", [CACHE_TAGS.categories]),
    fetchHomeData<{ data?: { hero: HomeBanner[]; promo: HomeBanner | null } }>("/v1/storefront/banners", [CACHE_TAGS.storefront]),
  ]);
  const tree = buildCategoryTree(categories?.categories);

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
        <HomeHero banners={banners?.data?.hero ?? []} />
        <TrustStrip />
        <CategoryArches tree={tree} />
        <FestivePromo tree={tree} banner={banners?.data?.promo ?? null} />
        <ShopByCategory tree={tree} />
        <PriceLockBand />
        <SellerOfferBand />
        <HomeProductFeed mains={tree} />
        <MoreAbout tree={tree} />
      </div>
    </>
  );
}
