import { PublicSiteChrome } from "@/components/layout/PublicSiteChrome";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicSiteChrome>{children}</PublicSiteChrome>;
}
