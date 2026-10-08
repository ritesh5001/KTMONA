import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  outputFileTracingRoot: configDir,
  turbopack: {
    root: configDir,
  },

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  IMAGE OPTIMISATION                                                    */
  /* ──────────────────────────────────────────────────────────────────────── */
  images: {
    // Resizing is ImageKit's job, not Vercel's.
    //
    // The default behaviour downloaded each full-size original from ImageKit to
    // a Vercel function, re-encoded it, and counted a metered transformation —
    // duplicating work an image CDN had already done, further from the user.
    // That quota ran out in production: /_next/image returned HTTP 402 and every
    // image not already cached rendered as alt text, including on product pages.
    //
    // With this loader Next never fetches a file. It emits a srcset of ImageKit
    // URLs and the browser pulls one correctly-sized AVIF from the nearest edge.
    // No quota, no per-image cost, and no single point of failure that can take
    // the catalogue down again.
    //
    // The loader passes non-ImageKit sources through untouched, so local art in
    // /public is served as-is — which is why those files are pre-compressed on
    // disk rather than relying on Vercel to shrink them at request time.
    loader: "custom",
    loaderFile: "./src/lib/imagekit-loader.ts",

    // Responsive breakpoints matching actual layout needs. These still drive the
    // widths in the srcset — the loader turns each into `tr:w-…`.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Allow remote patterns (ImageKit for seller uploads)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
    ],

    // Cache optimised local images for 60 days
    minimumCacheTTL: 5184000,
  },

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  CACHING HEADERS                                                       */
  /* ──────────────────────────────────────────────────────────────────────── */
  async headers() {
    return [
      {
        // Static assets in /public — immutable long-term cache
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Category images at root
        source: "/:path(category-sherwani|category-kurta|category-indo-western|category-accessories).jpg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Next.js optimised images
        source: "/_next/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // Static JS/CSS chunks
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Next.js static media/font assets
        source: "/_next/static/media/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Public root assets commonly used by SEO and browser chrome
        source: "/:path(logo.png|og.png|ktmona-logo.webp|ktmona-logo-light.webp|ktmona-icon.webp|favicon.ico|robots.txt|sitemap.xml|manifest.json)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // Static fonts shipped from /public/fonts
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  CSS OPTIMISATION                                                      */
  /* ──────────────────────────────────────────────────────────────────────── */
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
