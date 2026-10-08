import { PublicSiteChrome } from "@/components/layout/PublicSiteChrome";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicSiteChrome>{children}</PublicSiteChrome>;
}
