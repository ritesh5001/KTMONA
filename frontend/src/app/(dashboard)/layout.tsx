import { PublicSiteChrome } from "@/components/layout/PublicSiteChrome";
import { AccountNav } from "@/components/account/AccountNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicSiteChrome>
      <div className="ktm-panel bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:py-10">
          <AccountNav />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </PublicSiteChrome>
  );
}
