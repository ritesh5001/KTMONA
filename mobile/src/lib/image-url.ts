import { PixelRatio } from "react-native";

/**
 * Ask ImageKit for an image sized to how it is actually rendered.
 *
 * Every screen was loading originals — a 1200px product photo behind a 180px
 * card costs the shopper real bytes on mobile data and real decode time. The CDN
 * can resize, re-encode to AVIF/WebP and strip metadata for us, so the only
 * thing needed here is to inject the transform.
 *
 * Non-ImageKit URLs (or anything already carrying a `tr:` segment) are returned
 * untouched, so this is safe to apply blindly.
 */
const IMAGEKIT_HOST = "ik.imagekit.io";

/** ImageKit bills by resolution tier; rounding avoids a cache entry per device. */
const WIDTH_BUCKETS = [120, 200, 320, 480, 640, 828, 1080, 1440];

function bucketWidth(width: number): number {
  const target = Math.ceil(width);
  return WIDTH_BUCKETS.find((bucket) => bucket >= target) ?? WIDTH_BUCKETS[WIDTH_BUCKETS.length - 1];
}

export function imageUrl(
  source: string | null | undefined,
  options: { width?: number; quality?: number } = {}
): string | undefined {
  if (!source) return undefined;
  if (!source.includes(IMAGEKIT_HOST)) return source;
  if (source.includes("/tr:")) return source;

  const { width, quality = 70 } = options;
  if (!width || width <= 0) return source;

  // Render at device pixel density, capped — a 3x phone does not need a 3x
  // download of a thumbnail to look sharp.
  const scale = Math.min(PixelRatio.get(), 2);
  const target = bucketWidth(width * scale);

  const marker = `${IMAGEKIT_HOST}/`;
  const index = source.indexOf(marker);
  if (index === -1) return source;

  const afterHost = index + marker.length;
  const slash = source.indexOf("/", afterHost);
  if (slash === -1) return source;

  // https://ik.imagekit.io/<id>/<path>  ->  https://ik.imagekit.io/<id>/tr:.../<path>
  const head = source.slice(0, slash);
  const tail = source.slice(slash);

  // `c-at_max` is the important one. Without it, asking for a width larger than
  // the uploaded file makes ImageKit UPSCALE it — and an upscaled re-encode is
  // bigger than the original, not smaller. A real catalogue image here weighs
  // 77 KB untouched, 113 KB at w-1080, and 69 KB at w-1080 with c-at_max.
  //
  // Sellers upload whatever their phone produced, so widths vary and we can
  // never assume the source is large. Capping means a too-large request degrades
  // to "serve it at its natural size" instead of actively costing the shopper
  // bandwidth.
  return `${head}/tr:w-${target},q-${quality},f-auto,pr-true,c-at_max${tail}`;
}
