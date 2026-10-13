"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

/**
 * Full-screen viewer for product images in admin review screens, so the whole
 * image can be checked without copying its URL into a new tab.
 */
export function ImageLightbox({ images, index, onClose }: { images: string[]; index: number | null; onClose: () => void }) {
  const [current, setCurrent] = React.useState(index ?? 0);
  React.useEffect(() => {
    if (index != null) setCurrent(index);
  }, [index]);

  const open = index != null && images.length > 0;
  const step = React.useCallback((d: number) => setCurrent((c) => (c + d + images.length) % images.length), [images.length]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, step]);

  if (!open) return null;
  const src = images[current]!;

  return (
    <div role="dialog" aria-modal="true" aria-label="Image preview" className="fixed inset-0 z-[100] flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white" onClick={(e) => e.stopPropagation()}>
        <span>
          Image {current + 1} of {images.length}
        </span>
        <div className="flex items-center gap-2">
          <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-white/10">
            <ExternalLink className="h-4 w-4" /> Open original
          </a>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
        <img src={src} alt={`Image ${current + 1}`} className="max-h-full max-w-full rounded-lg bg-white object-contain" onClick={(e) => e.stopPropagation()} />
        {images.length > 1 ? (
          <>
            <button type="button" aria-label="Previous image" onClick={(e) => { e.stopPropagation(); step(-1); }} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" aria-label="Next image" onClick={(e) => { e.stopPropagation(); step(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
