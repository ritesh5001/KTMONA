"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";

const vendors = [
  {
    slug: "aarohi-atelier",
    name: "Aarohi Atelier",
    category: "Sarees & Ethnic",
    location: "Ahmedabad",
    rating: "4.9",
    specialty: "Handwoven Silk",
  },
  {
    slug: "saffron-loom",
    name: "Saffron Loom",
    category: "Cotton & Daily Wear",
    location: "Mumbai",
    rating: "4.8",
    specialty: "Organic Cotton",
  },
  {
    slug: "lenscraft-tailors",
    name: "LensCraft Tailors",
    category: "Men's Formal",
    location: "Delhi",
    rating: "4.7",
    specialty: "Bespoke Tailoring",
  },
  {
    slug: "bloomarc-studio",
    name: "BloomArc Studio",
    category: "Designer Wear",
    location: "Jaipur",
    rating: "4.8",
    specialty: "Contemporary Fusion",
  },
];

export default function VendorsPage() {
  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16 lg:py-20"
      >
        {/* Header */}
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
                Verified Sellers
              </p>
              <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Shop by Seller
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                Independent businesses from across India, each approved by the KTMONA team.
                Each seller is verified for quality, authenticity, and reliable delivery.
              </p>
            </div>

            {/* Trust Signals */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-brand" />
                Verified Craftsmanship
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-brand" />
                Quality Assured
              </span>
              <span className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-brand" />
                Reliable Delivery
              </span>
            </div>
          </div>

          {/* Search - Concierge Tool */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="border border-border-soft bg-card p-6 space-y-4"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Find a Seller
            </p>
            <Input placeholder="Search by name or city" className="h-12" />
            <button className="w-full h-12 bg-ink text-paper text-xs font-medium uppercase tracking-[0.15em] transition-all duration-400 hover:bg-navy dark:bg-brand dark:text-ink dark:hover:bg-brand-muted">
              Search Collection
            </button>
          </motion.div>
        </div>

        {/* Vendor Grid */}
        <section className="space-y-8">
          <div className="flex items-center justify-between border-b border-border-soft pb-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Featured Sellers ({vendors.length})
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
            {vendors.map((vendor, index) => (
              <motion.div
                key={vendor.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.08, duration: 0.5 }}
              >
                <Link href={`/vendors/${vendor.slug}`}>
                  <motion.div
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="group border border-border-soft bg-card p-6 lg:p-8 transition-all duration-400 hover:border-brand/40 hover:shadow-[0_4px_20px_rgba(255,138,0,0.10)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Vendor Info */}
                      <div className="space-y-4 flex-1">
                        <div className="space-y-2">
                          <h3 className="font-serif text-xl font-normal text-foreground group-hover:text-brand-strong transition-colors duration-300">
                            {vendor.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {vendor.category}
                          </p>
                        </div>

                        <div className="h-px bg-border-soft" />

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          {/* Provenance / Location */}
                          <span className="flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-brand/50" />
                            {vendor.location}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-brand/50" />
                            {vendor.specialty}
                          </span>
                        </div>
                      </div>

                      {/* Rating - Quiet */}
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-light text-foreground">
                          {vendor.rating}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Rating
                        </span>
                      </div>
                    </div>

                    {/* View Profile CTA */}
                    <div className="mt-6 pt-4 border-t border-border-soft">
                      <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground group-hover:text-brand-strong transition-colors duration-300">
                        View Profile →
                      </span>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Trust Footer */}
        <section className="border-t border-border-soft pt-12">
          <div className="text-center space-y-4">
            <p className="font-serif text-lg font-light text-foreground">
              Trusted by Discerning Buyers Across India
            </p>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Every seller on KTMONA is reviewed and approved before listing,
              and every product is checked before it goes live.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
