"use client";

import type { ImageLoaderProps } from "next/image";

/**
 * Hand image resizing to ImageKit instead of Vercel.
 *
 * By default `next/image` treats a remote URL as an opaque source: it downloads
 * the full original from ImageKit to the Vercel function, re-encodes it there,
 * and caches the result. That pays twice — ImageKit egress for bytes nobody
 * sees, plus a Vercel image-optimization unit, which is metered — to duplicate
 * work an image CDN already does better and closer to the user.
 *
 * With this loader Next never fetches the file at all. It emits a srcset of
 * ImageKit URLs and the browser pulls the right size straight from ImageKit's
 * edge. Lazy loading, layout stability and srcset all still work.
 *
 * Non-ImageKit sources (the local /images/* hero art) are returned untouched so
 * Next keeps optimising those normally.
 */

const IMAGEKIT_HOST = "ik.imagekit.io";

export function imagekitLoader({ src, width, quality }: ImageLoaderProps): string {
  if (!src.includes(IMAGEKIT_HOST)) return src;
  // Already carries an explicit transform — respect whatever the caller chose.
  if (src.includes("/tr:")) return src;

  const marker = `${IMAGEKIT_HOST}/`;
  const index = src.indexOf(marker);
  if (index === -1) return src;

  const afterHost = index + marker.length;
  const slash = src.indexOf("/", afterHost);
  if (slash === -1) return src;

  const head = src.slice(0, slash);
  const tail = src.slice(slash);

  // c-at_max: never upscale. Sellers upload whatever their phone produced, so a
  // request for 1920px against an 828px source would otherwise be re-encoded
  // LARGER than the original — measured at 113 KB versus 77 KB untouched.
  // Capping degrades gracefully to the source's natural size instead.
  //
  // f-auto: AVIF or WebP depending on what the browser advertises.
  // pr-true: progressive, so something appears before the last byte lands.
  const params = [
    `w-${width}`,
    `q-${quality ?? 70}`,
    "f-auto",
    "pr-true",
    "c-at_max",
  ].join(",");

  return `${head}/tr:${params}${tail}`;
}

export default imagekitLoader;
