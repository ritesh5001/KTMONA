"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { CarouselScrollContext } from "./MotionCarousel";

interface MotionCardProps {
  /** Image source (next/image compatible) */
  imageSrc: string;
  imageAlt: string;
  /** Responsive sizes attribute for next/image */
  sizes?: string;
  /** Aspect ratio Tailwind class, e.g. "aspect-square" or "aspect-3/4" */
  aspectClass?: string;
  /** Content rendered below the image */
  children?: React.ReactNode;
  /** Width class – controls responsive column sizing */
  widthClass?: string;
  /** Extra className on the outer snap wrapper */
  className?: string;
  /** Additional content overlaid on the image (e.g. wishlist button) */
  overlay?: React.ReactNode;
}

/**
 * Premium card with subtle horizontal parallax on the image.
 * Reads scrollX from the nearest <MotionCarousel> context.
 */
export function MotionCard({
  imageSrc,
  imageAlt,
  sizes = "(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 20vw",
  aspectClass = "aspect-square",
  children,
  widthClass = "w-[calc(50%-0.75rem)] md:w-[calc(33.333%-1rem)] xl:w-[calc(20%-1.2rem)]",
  className = "",
  overlay,
}: MotionCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const ctxScrollX = React.useContext(CarouselScrollContext);
  const fallback = useMotionValue(0);
  const scrollX = ctxScrollX ?? fallback;

  /* Calculate card's offset from scroll to drive parallax */
  const [cardLeft, setCardLeft] = React.useState(0);

  React.useEffect(() => {
    const measure = () => {
      if (cardRef.current) {
        setCardLeft(cardRef.current.offsetLeft);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* Map scroll position relative to card position → image translateX */
  const imageX = useTransform(scrollX, (v: number) => {
    const diff = v - cardLeft;
    /* Clamp the parallax to ±20px for subtle Swiggy-style movement */
    const clamped = Math.max(-200, Math.min(200, diff));
    return (clamped / 200) * -20;
  });

  return (
    <div
      ref={cardRef}
      className={`snap-center shrink-0 ${widthClass} ${className}`}
    >
      <article className="group overflow-hidden rounded-none border border-border-soft bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
        {/* Image with parallax */}
        <div className={`relative ${aspectClass} w-full overflow-hidden bg-mist dark:bg-navy/20`}>
          <motion.div
            className="absolute inset-0"
            style={ctxScrollX ? { x: imageX } : undefined}
          >
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              sizes={sizes}
              quality={70}
              loading="lazy"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </motion.div>
          {overlay}
        </div>

        {/* Content below image */}
        {children && <div>{children}</div>}
      </article>
    </div>
  );
}
