import { Metadata } from "next";
import { SellerShell } from "@/components/seller/SellerShell";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <SellerShell>{children}</SellerShell>;
}
