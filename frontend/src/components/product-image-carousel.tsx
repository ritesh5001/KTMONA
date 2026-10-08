"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface ProductImageCarouselProps {
  images: string[];
  title?: string | null;
}

export default function ProductImageCarousel({
  images,
  title,
}: ProductImageCarouselProps) {
  const safeImages = useMemo(
    () => (images.length ? images : ["/images/product-placeholder.svg"]),
    [images]
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const selectedIndex = selectedImage ? safeImages.indexOf(selectedImage) : 0;
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const goTo = useCallback(
    (index: number) => {
      const maxIndex = safeImages.length - 1;
      if (index < 0) {
        setSelectedImage(safeImages[maxIndex]);
        return;
      }
      if (index > maxIndex) {
        setSelectedImage(safeImages[0]);
        return;
      }
      setSelectedImage(safeImages[index]);
    },
    [safeImages]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-clip lg:flex-row"
    >
      {safeImages.length > 1 && (
        <div className="order-2 flex max-w-full gap-3 overflow-x-auto pb-1 lg:order-1 lg:max-h-185 lg:w-20 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0">
          {safeImages.map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => goTo(index)}
                className={`group relative h-16 w-16 shrink-0 overflow-hidden sm:h-20 sm:w-20 transition-all duration-300 ${isActive
                    ? "border-2 border-brand"
                    : "border border-border-soft hover:border-brand/50"
                  }`}
                aria-label={`View image ${index + 1}`}
              >
                <Image
                  src={image}
                  alt={title ?? "Product thumbnail"}
                  width={80}
                  height={80}
                  className="h-full w-full object-contain p-1 bg-card"
                  loading="lazy"
                  quality={75}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Main Image */}
      <div className="order-1 relative min-w-0 flex-1 lg:order-2">
        <div className="relative overflow-hidden border border-border-soft bg-card">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative aspect-4/5 w-full bg-card"
            >
              <Image
                src={safeImages[activeIndex]}
                alt={title ?? "Product image"}
                fill
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-cover object-top"
                quality={85}
                priority={activeIndex === 0}
              />
            </motion.div>
          </AnimatePresence>

          {safeImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => goTo(activeIndex - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center border border-border-soft bg-card/90 text-muted-foreground transition-all duration-300 hover:bg-card hover:text-foreground"
                aria-label="Previous image"
              >
                <span className="text-sm">←</span>
              </button>
              <button
                type="button"
                onClick={() => goTo(activeIndex + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center border border-border-soft bg-card/90 text-muted-foreground transition-all duration-300 hover:bg-card hover:text-foreground"
                aria-label="Next image"
              >
                <span className="text-sm">→</span>
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
