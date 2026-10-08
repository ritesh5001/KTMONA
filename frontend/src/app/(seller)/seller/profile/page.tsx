"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function SellerProfilePage() {
  const [user, setUser] = React.useState<{
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    status?: string | null;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
  } | null>(null);

  React.useEffect(() => {
    const match = document.cookie.match(/(?:^|; )ktmona_user=([^;]*)/);
    if (match) {
      try {
        setUser(JSON.parse(decodeURIComponent(match[1])));
      } catch {
        setUser(null);
      }
    }
  }, []);

  const accountFields = [
    { label: "Email", value: user?.email ?? "—" },
    { label: "Phone", value: user?.phone ?? "—" },
    { label: "Role", value: user?.role ?? "—" },
    { label: "Status", value: user?.status ?? "—" },
    { label: "Email Verified", value: user?.isEmailVerified ? "Verified" : "Not verified" },
    { label: "Phone Verified", value: user?.isPhoneVerified ? "Verified" : "Not verified" },
  ];

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 lg:py-20"
      >
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Seller Profile
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Business Account
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage your seller identity, verification status, and payout preferences.
          </p>
        </div>

        {/* Content */}
        <section className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          {/* Account Details */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="border border-border-soft bg-card"
          >
            <div className="border-b border-border-soft p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                Account Details
              </p>
              <p className="text-sm text-muted-foreground">
                Your verified business information
              </p>
            </div>

            <div className="grid gap-px bg-border-soft sm:grid-cols-2">
              {accountFields.map((field, index) => (
                <motion.div
                  key={field.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + index * 0.04, duration: 0.4 }}
                  className="bg-card p-6 space-y-2"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {field.label}
                  </p>
                  <p className="font-medium text-foreground">
                    {field.value}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Seller Tools */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="border border-border-soft bg-card h-fit"
          >
            <div className="border-b border-border-soft p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                Seller Tools
              </p>
              <p className="text-sm text-muted-foreground">
                Manage your business settings
              </p>
            </div>

            <div className="p-6 space-y-3">
              <motion.div
                whileHover={{ x: 4 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Button variant="outline" className="w-full justify-between h-12">
                  <span>Update Payout Details</span>
                  <span className="text-muted-foreground">→</span>
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ x: 4 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Button variant="outline" className="w-full justify-between h-12">
                  <span>Manage Store Profile</span>
                  <span className="text-muted-foreground">→</span>
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Button className="w-full h-12">
                  Contact Seller Support
                </Button>
              </motion.div>
            </div>

            {/* Trust Signal */}
            <div className="border-t border-border-soft p-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-green-600/60" />
                Account in Good Standing
              </div>
            </div>
          </motion.div>
        </section>

        {/* Quick Navigation */}
        <section className="border-t border-border-soft pt-8">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/seller/dashboard"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Dashboard
            </Link>
            <span className="h-1 w-1 rounded-full bg-border-soft" />
            <Link
              href="/seller/products"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Products
            </Link>
            <span className="h-1 w-1 rounded-full bg-border-soft" />
            <Link
              href="/seller/orders"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Orders
            </Link>
            <span className="h-1 w-1 rounded-full bg-border-soft" />
            <Link
              href="/seller/settlements"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Settlements
            </Link>
            <span className="h-1 w-1 rounded-full bg-border-soft" />
            <Link
              href="/seller/notifications"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Notifications
            </Link>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
