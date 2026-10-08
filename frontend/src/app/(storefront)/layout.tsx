import { PublicSiteChrome } from "@/components/layout/PublicSiteChrome";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicSiteChrome>{children}</PublicSiteChrome>;
}
