/** Same articles as the website blog (frontend/src/app/(storefront)/blog/posts.ts). */
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  blocks: { type: "h2" | "p"; text: string }[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "trending-wedding-outfits-for-men-2026",
    title: "Trending Wedding Outfits for Men in 2026",
    description:
      "Discover the most sought-after wedding outfits for Indian grooms this wedding season, from pastel sherwanis to asymmetrical Indo-Westerns.",
    date: "2026-03-12",
    author: "KTMONA Editorial",
    blocks: [
      { type: "p", text: "The modern groom is no longer confined to traditional red and gold. In 2026, wedding fashion for men is experiencing a renaissance of pastels, asymmetrical cuts, and sustainable textiles." },
      { type: "h2", text: "The Rise of Pastels" },
      { type: "p", text: "Ivory, mint green, and blush pink have taken center stage. Men are pairing intricate floral embroidery with these softer hues for daytime ceremonies." },
      { type: "h2", text: "Indo-Western Dominance" },
      { type: "p", text: "For receptions and sangeet nights, the traditional Sherwani is making way for the Indo-Western jacket. Draped kurtas layered beneath structured bandhgalas create a majestic silhouette." },
    ],
  },
  {
    slug: "how-to-style-kurta-pajama-for-haldi",
    title: "How to Style a Kurta Pajama for Your Haldi",
    description: "The complete guide on choosing the perfect yellow kurta set for your Haldi ceremony without sacrificing comfort.",
    date: "2026-02-28",
    author: "KTMONA Editors",
    blocks: [
      { type: "p", text: "The Haldi ceremony is an intimate, energetic, and unavoidably messy affair. Choosing the right outfit balances heritage style with practical comfort." },
      { type: "h2", text: "Fabric is Everything" },
      { type: "p", text: "Stick to lightweight Chanderi silk or pure cotton. These fabrics breathe well and resist trapping heat during outdoor morning functions." },
      { type: "h2", text: "Color Combinations" },
      { type: "p", text: "While mustard yellow is classic, experimenting with ochre, ivory, and soft peach can help you stand out. Pair it with an ivory churidar for a classic finish." },
    ],
  },
];
