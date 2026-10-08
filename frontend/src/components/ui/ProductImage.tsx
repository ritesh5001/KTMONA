"use client";

import Image, { type ImageProps } from "next/image";
import { imagekitLoader } from "@/lib/imagekit-loader";

/**
 * Product imagery, served straight from ImageKit.
 *
 * Every catalogue image is already on ImageKit, which is a CDN with a resizing
 * engine on it. Passing those through Vercel's optimiser meant downloading the
 * full original to a serverless function, re-encoding it, and burning a metered
 * transformation — to duplicate work that had already been done, further from
 * the user. In production that quota ran out: `/_next/image` returned HTTP 402
 * and every image not already cached rendered as alt text.
 *
 * `unoptimized` here does not mean "unoptimised". It means Vercel does not touch
 * it — the loader has already asked ImageKit for the exact width, in AVIF or
 * WebP, capped so it is never upscaled. The browser fetches one correctly-sized
 * file from the nearest edge.
 *
 * Local artwork in /public still goes through `next/image` normally; that is
 * 12.5 MB of large JPEGs which genuinely need optimising, and Vercel's quota is
 * no longer being spent on the catalogue.
 */
export function ProductImage({
  src,
  alt,
  ...rest
}: Omit<ImageProps, "loader" | "unoptimized">) {
  const isImageKit = typeof src === "string" && src.includes("ik.imagekit.io");

  if (!isImageKit) {
    // Local or unknown host — let Next optimise it as before.
    return <Image src={src} alt={alt} {...rest} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      loader={imagekitLoader}
      unoptimized
      {...rest}
    />
  );
}

export default ProductImage;
