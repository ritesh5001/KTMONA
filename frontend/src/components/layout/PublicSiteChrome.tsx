import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { AppDownloadPromo } from "@/components/site/AppDownloadPromo";

export function PublicSiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <main className="min-h-[calc(100vh-160px)] overflow-x-clip">{children}</main>
      <PublicFooter />
      <AppDownloadPromo />
    </>
  );
}
