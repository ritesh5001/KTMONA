export interface HeroSlide {
  id: number;
  heading: string;
  subtext: string;
  button: string;
  href: string;
  desktopImage: string;
  mobileImage: string;
  textPosition: "left" | "right";
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 1,
    heading: "Trust Every Click",
    subtext: "Shop from verified sellers across India, all in one place.",
    button: "Start Shopping",
    href: "/marketplace",
    desktopImage: "/images/hero/1st desktop banner.jpg",
    mobileImage: "/images/hero/1st mobile banner.jpeg",
    textPosition: "left",
  },
  {
    id: 2,
    heading: "Style for Every Occasion",
    subtext: "Fresh fashion picks from independent Indian sellers.",
    button: "Shop the Marketplace",
    href: "/marketplace",
    desktopImage: "/images/hero/2nd desktop banner.jpg",
    mobileImage: "/images/hero/2nd mobile banner.jpeg",
    textPosition: "right",
  },
  {
    id: 3,
    heading: "Festive Edits, Ready to Ship",
    subtext: "Curated collections with secure payments and easy returns.",
    button: "Discover Collections",
    href: "/marketplace",
    desktopImage: "/images/hero/3rd desktop banner.jpg",
    mobileImage: "/images/hero/3rd mobile banner.jpeg",
    textPosition: "left",
  },
  {
    id: 4,
    heading: "Quality You Can Trust",
    subtext: "Every seller verified. Every product reviewed before it goes live.",
    button: "Start Exploring",
    href: "/marketplace",
    desktopImage: "/images/hero/4th desktop banner.jpg",
    mobileImage: "/images/hero/4th mobile banner.jpeg",
    textPosition: "right",
  },
];

export const PRIMARY_HERO_SLIDE = HERO_SLIDES[0];
