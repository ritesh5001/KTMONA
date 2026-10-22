import { AccountProductGrid } from "@/components/account/AccountProductGrid";

export default function RecommendedPage() {
  return (
    <AccountProductGrid
      endpoint="/v1/personalization/recommendations"
      eyebrow="Personalized Picks"
      title="Recommended For You"
      description="Picked from your wishlist, orders and the products you viewed."
      emptyText="We'll have recommendations for you once you start browsing."
    />
  );
}
