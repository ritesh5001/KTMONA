"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useAnimationFrame,
  type MotionValue,
} from "framer-motion";

/* ── Context shared with children (MotionCard) ── */
export const CarouselScrollContext = React.createContext<MotionValue<number> | null>(null);

interface MotionCarouselProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Premium horizontal scroll carousel with drag + scroll-snap.
 * Exposes a scrollX MotionValue via context so children can apply
 * parallax effects keyed to their position in the scroll track.
 */
export function MotionCarousel({ children, className = "" }: MotionCarouselProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollX = useMotionValue(0);

  /* Keep motionValue in sync with native scroll position */
  useAnimationFrame(() => {
    const el = containerRef.current;
    if (el) scrollX.set(el.scrollLeft);
  });

  return (
    <CarouselScrollContext.Provider value={scrollX}>
      <div className={`relative ${className}`}>
        {/* Scroll track */}
        <motion.div
          ref={containerRef}
          className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory px-1 py-1 scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </motion.div>

        {/* Fade edges – subtle visual cue that more content exists */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background/60 to-transparent max-sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background/60 to-transparent max-sm:hidden" />
      </div>
    </CarouselScrollContext.Provider>
  );
}
