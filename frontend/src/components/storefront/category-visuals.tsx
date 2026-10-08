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

/**
 * Placeholder art for the main categories until real photos are uploaded in
 * Admin → Categories. Each main category gets an icon and a soft colour; a
 * category with an `image` set shows that photo instead.
 */
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

export function categoryVisual(slug: string): Visual {
  return VISUALS[slug] ?? FALLBACK;
}

/** Category art: the uploaded image when there is one, otherwise the icon. */
export function CategoryArt({
  slug,
  image,
  name,
  className,
  iconClassName,
}: {
  slug: string;
  image?: string | null;
  name: string;
  className?: string;
  iconClassName?: string;
}) {
  const v = categoryVisual(slug);
  const Icon = v.icon;
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden", className)} style={{ backgroundColor: v.bg }}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Icon className={cn("h-1/2 w-1/2", iconClassName)} style={{ color: v.fg }} strokeWidth={1.4} aria-hidden />
      )}
    </div>
  );
}
