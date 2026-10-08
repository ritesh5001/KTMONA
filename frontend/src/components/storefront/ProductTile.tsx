import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export interface ProductTileData {
  id: string;
  title: string;
  images?: string[];
  price?: number | null;
  salePrice?: number | null;
  regularPrice?: number | null;
  rating?: { average: number | null; count: number } | null;
}

/**
 * Meesho-style product card: photo, one-line title, price with the real MRP
 * struck through when there is one, a delivery note and the review score.
 * Nothing on it is invented: no rating shows until the product has reviews.
 */
export function ProductTile({ product, freeDelivery }: { product: ProductTileData; freeDelivery: boolean }) {
  const price = product.salePrice ?? product.price ?? null;
  const mrp = product.regularPrice != null && price != null && product.regularPrice > price ? product.regularPrice : null;
  const off = mrp && price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const image = product.images?.[0] ?? "/images/product-placeholder.svg";
  const rating = product.rating && product.rating.count > 0 && product.rating.average != null ? product.rating : null;

  return (
    <Link
      href={`/product/${product.id}`}
      prefetch={false}
      className="group block overflow-hidden rounded-lg border border-border-soft bg-card transition-shadow hover:shadow-[0_6px_20px_rgba(12,27,66,0.10)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-mist">
        <Image
          src={image}
          alt={product.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="truncate text-sm text-muted-foreground">{product.title}</h3>
        {price != null ? (
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-lg font-bold leading-none text-foreground">{inr.format(price)}</span>
            {mrp ? (
              <>
                <span className="text-xs text-muted-foreground line-through">{inr.format(mrp)}</span>
                <span className="text-xs font-semibold text-emerald-600">{off}% off</span>
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Price on request</p>
        )}
        {freeDelivery ? (
          <span className="inline-block rounded-full bg-mist px-2 py-0.5 text-[11px] font-medium text-muted-foreground dark:bg-navy/40">Free Delivery</span>
        ) : null}
        <div className="flex h-5 items-center gap-1.5">
          {rating ? (
            <>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                {rating.average!.toFixed(1)} <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
              </span>
              <span className="text-[11px] text-muted-foreground">{rating.count.toLocaleString("en-IN")} {rating.count === 1 ? "Review" : "Reviews"}</span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">New arrival</span>
          )}
        </div>
      </div>
    </Link>
  );
}
