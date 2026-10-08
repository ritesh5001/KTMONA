"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const services = [
  "Custom tailoring",
  "Fabric sourcing",
  "Size & fit guidance",
  "Express alterations",
];

const packages = [
  {
    name: "Signature Ethnic Set",
    price: "₹7,800",
    detail: "Handcrafted fabric + premium finish",
  },
  {
    name: "Royal Couture",
    price: "₹12,500",
    detail: "Custom silhouette + priority tailoring",
  },
];

export default function VendorProfilePage() {
  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 lg:py-20"
      >
        {/* Hero Section */}
        <section className="border border-border-soft bg-card p-8 lg:p-12 space-y-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
                  Verified Seller
                </p>
                <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
                  Aarohi Atelier
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-brand" />
                  Ahmedabad
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-brand" />
                  Sarees & Ethnic
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-brand" />
                  4.9 Rating
                </span>
                <span className="text-xs px-2 py-0.5 border border-border-soft">
                  4,200+ orders
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline">Save Brand</Button>
              <Button>Contact Seller</Button>
            </div>
          </div>

          <div className="h-px bg-border-soft" />

          <p className="text-sm leading-relaxed text-muted-foreground max-w-2xl">
            A verified KTMONA seller with curated collections, quality-checked
            listings and dedicated customer support.
          </p>
        </section>

        {/* Services & Packages Grid */}
        <section className="grid gap-6 lg:grid-cols-3">
          {/* Services */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="border border-border-soft bg-card"
          >
            <div className="border-b border-border-soft p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                Services Offered
              </p>
              <p className="font-serif text-lg font-light text-foreground">
                Craftsmanship
              </p>
            </div>
            <div className="p-6 space-y-3">
              {services.map((service, index) => (
                <motion.div
                  key={service}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + index * 0.05, duration: 0.4 }}
                  className="flex items-center gap-3 py-3 px-4 border border-border-soft bg-mist/30 dark:bg-navy/10"
                >
                  <span className="h-1 w-1 rounded-full bg-brand" />
                  <span className="text-sm text-foreground">{service}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Packages */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="lg:col-span-2 border border-border-soft bg-card"
          >
            <div className="border-b border-border-soft p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                Curated Packages
              </p>
              <p className="font-serif text-lg font-light text-foreground">
                Bespoke Collections
              </p>
            </div>
            <div className="grid gap-px bg-border-soft sm:grid-cols-2">
              {packages.map((pack, index) => (
                <motion.div
                  key={pack.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
                  whileHover={{ y: -2 }}
                  className="bg-card p-6 space-y-4 transition-all duration-300"
                >
                  <div className="space-y-2">
                    <p className="font-serif text-lg font-normal text-foreground">
                      {pack.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pack.detail}
                    </p>
                  </div>
                  <div className="h-px bg-border-soft" />
                  <div className="flex items-center justify-between">
                    <p className="font-serif text-xl font-light text-foreground">
                      {pack.price}
                    </p>
                    <Button size="sm" variant="outline">
                      Request Quote
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Featured Offerings */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="border border-border-soft bg-card p-6 lg:p-8 space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                Featured Collections
              </p>
              <p className="font-serif text-lg font-light text-foreground">
                Current Offerings
              </p>
            </div>
            <Link
              href="/marketplace"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Browse All →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {["Festive Saree Capsule", "Signature Silk Collection"].map(
              (item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between py-4 px-5 border border-border-soft bg-mist/30 dark:bg-navy/10 transition-all duration-300 hover:border-brand/40"
                >
                  <span className="text-sm text-foreground">{item}</span>
                  <span className="text-muted-foreground">→</span>
                </motion.div>
              )
            )}
          </div>
        </motion.section>

        {/* Trust Footer */}
        <section className="border-t border-border-soft pt-8">
          <div className="flex flex-wrap items-center justify-center gap-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Verified Seller
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Quality Assured
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Buyer Protection
            </span>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
