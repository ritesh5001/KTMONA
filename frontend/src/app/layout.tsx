import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { SITE_URL } from "@/lib/site-config";
import { NavigationProgress } from "@/components/navigation/NavigationProgress";

const API_ORIGIN = (() => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
})();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "KTMONA | Trust Every Click | Online Multi-Vendor Marketplace in India",
    template: "%s | KTMONA",
  },
  description:
    "KTMONA (Knowledge, Trust & More Online Network Access) is a trusted multi-vendor marketplace. Shop fashion, lifestyle and everyday products from verified Indian sellers with secure payments and doorstep delivery.",
  keywords: [
    "KTMONA",
    "online marketplace india",
    "multi vendor marketplace",
    "shop from verified sellers",
    "online shopping india",
    "sell online india",
    "fashion and lifestyle store",
    "trust every click",
  ],
  openGraph: {
    title: "KTMONA | Trust Every Click",
    description:
      "Shop fashion, lifestyle and everyday products from verified Indian sellers on KTMONA, with secure payments and doorstep delivery.",
    siteName: "KTMONA",
    url: SITE_URL,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "KTMONA - Trust Every Click",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KTMONA | Trust Every Click",
    description:
      "Shop fashion, lifestyle and everyday products from verified Indian sellers on KTMONA.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-64.png", type: "image/png", sizes: "64x64" },
      { url: "/ktmona-icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon-64.png",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0C1B42" },
    { media: "(prefers-color-scheme: dark)", color: "#070F26" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        {/* Preconnect to critical external origins to cut DNS/TLS latency */}
        <link rel="preconnect" href="https://ik.imagekit.io" />
        {API_ORIGIN && <link rel="preconnect" href={API_ORIGIN} />}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const key = 'ktmona-theme';
    const stored = localStorage.getItem(key);
    const isDark = stored === 'dark';
    if (!stored) {
      localStorage.setItem(key, 'light');
    }
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (_) {}
})();`,
          }}
        />
      </head>
      <body
        className="min-h-screen bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "KTMONA",
              url: SITE_URL,
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${SITE_URL}/marketplace?search={search_term_string}`
                },
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
        {children}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
      </body>
    </html>
  );
}
