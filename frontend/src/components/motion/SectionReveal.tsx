"use client";

import * as React from "react";

type SectionRevealProps = {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  distance?: number;
  threshold?: number;
  rootMargin?: string;
};

export function SectionReveal({
  children,
  className = "",
  delayMs = 0,
  distance = 18,
  threshold = 0.14,
  rootMargin = "0px 0px -10% 0px",
}: SectionRevealProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = React.useState(false);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      setReady(true);
      setVisible(true);
      return;
    }

    const initiallyVisible = node.getBoundingClientRect().top <= window.innerHeight * 0.92;
    if (initiallyVisible) {
      setReady(true);
      setVisible(true);
      return;
    }

    setReady(true);
    setVisible(false);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold, rootMargin }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  const isRevealed = !ready || visible;

  return (
    <div
      ref={ref}
      className={`transform-gpu transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isRevealed ? "translate-y-0 opacity-100" : "opacity-0"} ${className}`}
      style={{
        transform: isRevealed ? "translate3d(0, 0, 0)" : `translate3d(0, ${distance}px, 0)`,
        transitionDelay: isRevealed && ready ? `${delayMs}ms` : "0ms",
      }}
    >
      {children}
    </div>
  );
}
