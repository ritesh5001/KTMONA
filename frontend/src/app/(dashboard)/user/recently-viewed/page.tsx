import { AccountProductGrid } from "@/components/account/AccountProductGrid";

export default function RecentlyViewedPage() {
  return (
    <AccountProductGrid
      endpoint="/v1/personalization/recently-viewed"
      eyebrow="My Account"
      title="Recently Viewed"
      description="Products you opened recently, newest first."
      emptyText="Products you open will appear here."
    />
  );
}
