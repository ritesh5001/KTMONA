import {
  Bike,
  BookOpen,
  CookingPot,
  Dumbbell,
  Flower2,
  Footprints,
  Gem,
  Guitar,
  Headphones,
  Heart,
  Lightbulb,
  NotebookPen,
  PawPrint,
  Shirt,
  ShoppingBasket,
  Sparkles,
  ToyBrick,
  Watch,
  Ribbon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BANNER_IMAGES, CARD_IMAGE_SLUGS, CATEGORY_IMAGE_SLUGS } from "@/components/storefront/storefront-images";

/** Icon and colours for a main category, used when it has no photo. */
interface Visual {
  icon: LucideIcon;
  /** Tile background (light) and icon colour. */
  bg: string;
  fg: string;
}

const VISUALS: Record<string, Visual> = {
  "kurti-saree": { icon: Flower2, bg: "#FCE7F3", fg: "#BE185D" },
  "women-western": { icon: Sparkles, bg: "#EDE9FE", fg: "#6D28D9" },
  lingerie: { icon: Ribbon, bg: "#FFE4E6", fg: "#E11D48" },
  men: { icon: Shirt, bg: "#DBEAFE", fg: "#1D4ED8" },
  "kids-toys": { icon: ToyBrick, bg: "#FEF3C7", fg: "#B45309" },
  "home-kitchen": { icon: CookingPot, bg: "#FFEDD5", fg: "#C2410C" },
  "beauty-health": { icon: Heart, bg: "#FCE7F3", fg: "#DB2777" },
  "jewellery-accessories": { icon: Gem, bg: "#FEF9C3", fg: "#A16207" },
  "bags-footwear": { icon: Footprints, bg: "#E0E7FF", fg: "#4338CA" },
  electronics: { icon: Headphones, bg: "#E0F2FE", fg: "#0369A1" },
  watches: { icon: Watch, bg: "#F1F5F9", fg: "#334155" },
  electricals: { icon: Lightbulb, bg: "#FEF3C7", fg: "#CA8A04" },
  "sports-fitness": { icon: Dumbbell, bg: "#DCFCE7", fg: "#15803D" },
  "car-motorbike": { icon: Bike, bg: "#E2E8F0", fg: "#0F172A" },
  "office-supplies-stationery": { icon: NotebookPen, bg: "#E0F2FE", fg: "#0E7490" },
  grocery: { icon: ShoppingBasket, bg: "#DCFCE7", fg: "#166534" },
  books: { icon: BookOpen, bg: "#FFEDD5", fg: "#9A3412" },
  "pet-supplies": { icon: PawPrint, bg: "#FEF3C7", fg: "#92400E" },
  "musical-instruments": { icon: Guitar, bg: "#F3E8FF", fg: "#7E22CE" },
};

const FALLBACK: Visual = { icon: Sparkles, bg: "#FFF1E0", fg: "#E05A00" };

/**
 * Built-in key for a category whose slug is not one of ours, matched on the
 * words in its slug ("women-fashion" → women-western, "mens-clothing" → men).
 * Lets categories built in Category Builder keep the built-in photos.
 * Order matters: "women" is checked before "men".
 */
const KEYWORD_ALIASES: [RegExp, string][] = [
  [/^(sarees?|kurtis?|kurtas?-women|ethnic-women|women-ethnic)$/, "kurti-saree"],
  [/^(lingerie|bra|bras|nightwear)$/, "lingerie"],
  [/^(women|womens|woman|ladies|girls?)$/, "women-western"],
  [/^(kids?|toys?|baby|babies|infant)$/, "kids-toys"],
  [/^(men|mens|man|gents|boys?)$/, "men"],
  [/^(home|kitchen|decor|furnishing|furniture|living|dining)$/, "home-kitchen"],
  [/^(beauty|health|wellness|makeup|skincare|personal|care)$/, "beauty-health"],
  [/^(jewell?ery|jewelry|accessories|accessory)$/, "jewellery-accessories"],
  [/^(bags?|footwear|shoes?|sandals?|handbags?)$/, "bags-footwear"],
  [/^(electronics?|mobiles?|tablets?|laptops?|computers?|audio|cameras?|gadgets?)$/, "electronics"],
  [/^(watch|watches)$/, "watches"],
  [/^(electricals?|appliances?)$/, "electricals"],
  [/^(sports?|fitness|gym)$/, "sports-fitness"],
  [/^(car|cars|bike|bikes|motorbike|automotive)$/, "car-motorbike"],
  [/^(office|stationery|stationary)$/, "office-supplies-stationery"],
  [/^(grocery|groceries|food)$/, "grocery"],
  [/^(books?)$/, "books"],
  [/^(pets?)$/, "pet-supplies"],
  [/^(music|musical|instruments?)$/, "musical-instruments"],
];

function builtInKey(slug: string): string {
  if (VISUALS[slug]) return slug;
  const words = slug.toLowerCase().split("-").filter(Boolean);
  for (const [re, key] of KEYWORD_ALIASES) {
    if (words.some((w) => re.test(w))) return key;
  }
  return slug;
}

export function categoryVisual(slug: string): Visual {
  return VISUALS[builtInKey(slug)] ?? FALLBACK;
}

/**
 * Built-in photo for a category (main categories and the homepage cards),
 * used until an image is uploaded for it in Admin → Categories.
 */
export function defaultCategoryImage(slug: string): string | null {
  if (CATEGORY_IMAGE_SLUGS.has(slug)) return `/storefront/categories/${slug}.webp`;
  if (CARD_IMAGE_SLUGS.has(slug)) return `/storefront/cards/${slug}.webp`;
  const key = builtInKey(slug);
  if (key !== slug && CATEGORY_IMAGE_SLUGS.has(key)) return `/storefront/categories/${key}.webp`;
  return null;
}

/** Built-in banner photo by key (e.g. "hero-smart"), or null if not present. */
export function defaultBannerImage(key: string): string | null {
  return BANNER_IMAGES.has(key) ? `/storefront/banners/${key}.webp` : null;
}

/**
 * Category art. Order of preference: the image uploaded in Admin → Categories,
 * the built-in photo in public/storefront, the newest product's photo, then an
 * icon on the category colour.
 */
export function CategoryArt({
  slug,
  image,
  fallbackImage,
  name,
  className,
  iconClassName,
}: {
  slug: string;
  image?: string | null;
  /** Newest product photo in the category, used when nothing else fits. */
  fallbackImage?: string | null;
  name: string;
  className?: string;
  iconClassName?: string;
}) {
  const v = categoryVisual(slug);
  const Icon = v.icon;
  const src = image ?? defaultCategoryImage(slug) ?? fallbackImage ?? null;
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden", className)} style={{ backgroundColor: v.bg }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <Icon className={cn("h-1/2 w-1/2", iconClassName)} style={{ color: v.fg }} strokeWidth={1.4} aria-hidden />
      )}
    </div>
  );
}
