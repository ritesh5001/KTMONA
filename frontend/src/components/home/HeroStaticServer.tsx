"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HERO_SLIDES } from "@/components/home/hero-data";

export function HeroStaticServer() {
  const slides = HERO_SLIDES.slice(0, 4);
  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const pointerDragging = useRef(false);
  const wheelDeltaX = useRef(0);
  const wheelLockUntil = useRef(0);

  const showNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % slides.length);
  }, [slides.length]);

  const showPrev = () => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      showNext();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [showNext]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStartX.current = event.clientX;
    pointerStartY.current = event.clientY;
    pointerDragging.current = true;
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDragging.current || pointerStartX.current === null || pointerStartY.current === null) {
      return;
    }

    const deltaX = event.clientX - pointerStartX.current;
    const deltaY = event.clientY - pointerStartY.current;

    pointerDragging.current = false;
    pointerStartX.current = null;
    pointerStartY.current = null;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0) {
      showNext();
      return;
    }

    showPrev();
  };

  const onPointerCancel = () => {
    pointerDragging.current = false;
    pointerStartX.current = null;
    pointerStartY.current = null;
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now < wheelLockUntil.current) return;

    // Touchpads emit wheel deltas for two-finger swipe gestures.
    // We only react to primarily horizontal swipes.
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

    wheelDeltaX.current += event.deltaX;
    if (Math.abs(wheelDeltaX.current) < 45) return;

    event.preventDefault();

    if (wheelDeltaX.current > 0) {
      showNext();
    } else {
      showPrev();
    }

    wheelDeltaX.current = 0;
    wheelLockUntil.current = now + 350;
  };

  return (
    <section className="relative w-full overflow-hidden bg-ink aspect-square md:aspect-21/8" aria-label="Hero carousel">
      <div
        className="relative h-full touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
      >
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          const isRight = slide.textPosition === "right";

          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!isActive}
            >
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 hidden md:block">
                  <Image
                    src={slide.desktopImage}
                    alt={slide.heading}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    quality={75}
                    priority={index === 0}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </div>

                <div className="absolute inset-0 block md:hidden">
                  <Image
                    src={slide.mobileImage}
                    alt={slide.heading}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    quality={75}
                    priority={index === 0}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </div>

                <div className={`absolute inset-0 z-10 hidden md:block ${isRight ? "bg-linear-to-l from-black/80 via-black/45 to-transparent" : "bg-linear-to-r from-black/80 via-black/45 to-transparent"}`} />
                <div className="absolute inset-0 z-10 block md:hidden bg-linear-to-b from-black/55 via-black/20 to-transparent" />
                <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.25)_100%)]" />
                <div className="absolute bottom-0 left-0 right-0 z-10 h-28 bg-linear-to-t from-black/25 to-transparent md:hidden" />
              </div>

              <div className={`absolute inset-0 z-20 flex items-end justify-center px-6 pb-12 sm:pb-16 md:items-center md:pb-0 md:px-0 ${isRight ? "md:justify-end" : "md:justify-start"}`}>
                <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
                  <div className={`max-w-xl text-center ${isRight ? "md:ml-auto md:text-right" : "md:text-left"}`}>
                    <h1 className="font-serif text-3xl font-light leading-[1.1] tracking-tight text-white drop-shadow-[0_16px_32px_rgba(0,0,0,0.75)] sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
                      {slide.heading}
                    </h1>

                    <p className={`mt-4 max-w-md text-sm leading-relaxed text-white/80 drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)] sm:mt-5 sm:text-base md:text-lg ${isRight ? "md:ml-auto" : ""}`}>
                      {slide.subtext}
                    </p>

                    <div className={`mt-7 sm:mt-9 ${isRight ? "md:flex md:justify-end" : ""}`}>
                      <Link
                        href={slide.href}
                        className="inline-flex items-center justify-center rounded-lg border border-brand-light/50 bg-brand px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink shadow-[0_8px_24px_rgba(255,138,0,0.35)] backdrop-blur-[2px] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-[0_12px_28px_rgba(255,138,0,0.45)] sm:px-10 sm:py-3.5"
                      >
                        {slide.button}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-2.5 rounded-full transition-all duration-300 ${index === activeIndex ? "w-7 bg-brand" : "w-2.5 bg-white/70 hover:bg-white"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
