"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Eye, Heart, Loader2, ShoppingBag, X } from "lucide-react";
import { listPublicReels, likeReel, unlikeReel, checkReelLiked, recordReelView, recordProductClick, type Reel } from "@/services/reels";
import { useAuth } from "@/hooks/use-auth";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function ReelFeedPage() {
  const { token } = useAuth();
  const [reels, setReels] = React.useState<Reel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [activeCategory, setActiveCategory] = React.useState<"MENS" | "KIDS">("MENS");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Engagement state
  const [likedMap, setLikedMap] = React.useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = React.useState<Record<string, number>>({});
  const [viewedSet, setViewedSet] = React.useState<Set<string>>(new Set());

  const loadReels = React.useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const result = await listPublicReels({ page: pageNum, limit: 10, category: activeCategory });
      const newReels = result.reels ?? [];
      if (append) {
        setReels((prev) => [...prev, ...newReels]);
      } else {
        setReels(newReels);
        setCurrentIndex(0);
      }
      const totalPages = Math.max(1, result.pagination?.totalPages ?? 1);
      setHasMore(pageNum < totalPages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeCategory]);

  React.useEffect(() => {
    loadReels(1);
  }, [loadReels]);

  // Track view when current reel changes
  React.useEffect(() => {
    const reel = reels[currentIndex];
    if (!reel || viewedSet.has(reel.id)) return;
    setViewedSet((prev) => new Set(prev).add(reel.id));
    recordReelView(reel.id, token).catch(() => {});
  }, [currentIndex, reels, token, viewedSet]);

  // Check if current reel is liked (authenticated users only)
  React.useEffect(() => {
    const reel = reels[currentIndex];
    if (!reel || !token || likedMap[reel.id] !== undefined) return;
    checkReelLiked(reel.id, token)
      .then((res) => setLikedMap((prev) => ({ ...prev, [reel.id]: res.liked })))
      .catch(() => {});
  }, [currentIndex, reels, token, likedMap]);

  // Initialize like counts from reel data
  React.useEffect(() => {
    const newCounts: Record<string, number> = {};
    for (const reel of reels) {
      if (likeCounts[reel.id] === undefined) {
        newCounts[reel.id] = reel.likes;
      }
    }
    if (Object.keys(newCounts).length > 0) {
      setLikeCounts((prev) => ({ ...prev, ...newCounts }));
    }
  }, [reels, likeCounts]);

  const handleLikeToggle = React.useCallback(async () => {
    const reel = reels[currentIndex];
    if (!reel || !token) return;
    const isLiked = likedMap[reel.id] ?? false;
    try {
      if (isLiked) {
        await unlikeReel(reel.id, token);
        setLikedMap((prev) => ({ ...prev, [reel.id]: false }));
        setLikeCounts((prev) => ({ ...prev, [reel.id]: Math.max(0, (prev[reel.id] ?? 0) - 1) }));
      } else {
        await likeReel(reel.id, token);
        setLikedMap((prev) => ({ ...prev, [reel.id]: true }));
        setLikeCounts((prev) => ({ ...prev, [reel.id]: (prev[reel.id] ?? 0) + 1 }));
      }
    } catch {
      // silently fail
    }
  }, [reels, currentIndex, token, likedMap]);

  const handleProductClick = React.useCallback((reelId: string) => {
    recordProductClick(reelId, token).catch(() => {});
  }, [token]);

  const goNext = React.useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.min(prev + 1, reels.length - 1);
      // Load more when nearing end
      if (next >= reels.length - 3 && hasMore && !loadingMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        loadReels(nextPage, true);
      }
      return next;
    });
  }, [reels.length, hasMore, loadingMore, page, loadReels]);

  const goPrev = React.useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") goNext();
      if (e.key === "ArrowUp" || e.key === "k") goPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  // Touch/scroll navigation
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0]?.clientY ?? 0;
      const diff = startY - endY;
      if (Math.abs(diff) > 50) {
        if (diff > 0) goNext();
        else goPrev();
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [goNext, goPrev]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-160px)] bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    );
  }

  // We still need the main UI wrapper for the switcher, even if reels are empty.
  const renderCategorySwitcher = () => (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/10">
      <button
        onClick={() => { setActiveCategory("MENS"); setPage(1); setReels([]); }}
        className={`px-6 py-1.5 rounded-full text-sm font-medium transition-all ${
          activeCategory === "MENS" ? "bg-white text-black" : "text-white/70 hover:text-white"
        }`}
      >
        Mens
      </button>
      <button
        onClick={() => { setActiveCategory("KIDS"); setPage(1); setReels([]); }}
        className={`px-6 py-1.5 rounded-full text-sm font-medium transition-all ${
          activeCategory === "KIDS" ? "bg-white text-black" : "text-white/70 hover:text-white"
        }`}
      >
        Kids
      </button>
    </div>
  );

  if (reels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] bg-black text-white relative">
        <Link
          href="/"
          className="absolute top-4 left-4 z-30 p-2 text-white/70 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </Link>
        {renderCategorySwitcher()}
        <p className="text-white/60 mt-10">No reels available yet in {activeCategory === "MENS" ? "Mens" : "Kids"} category</p>
      </div>
    );
  }

  const currentReel = reels[currentIndex];
  if (!currentReel) return null;

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[calc(100vh-160px)] bg-black flex items-center justify-center overflow-hidden pb-20"
    >
      {/* Back Button */}
      <Link
        href="/"
        className="absolute top-4 left-4 z-30 p-2 text-white/70 hover:text-white transition-colors"
      >
        <X className="h-6 w-6" />
      </Link>

      {/* Category Switcher */}
      {renderCategorySwitcher()}

      {/* Navigation Arrows (desktop) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col gap-2">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex === reels.length - 1 && !hasMore}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Reel Counter */}
      <div className="absolute top-4 right-4 z-30 text-white/50 text-xs">
        {currentIndex + 1} / {reels.length}
      </div>

      {/* Reel Content */}
      <div
        key={currentReel.id}
        className="relative w-full max-w-md h-[calc(100vh-240px)] min-h-105 max-h-190 flex flex-col"
      >
          {/* Video */}
          <video
            key={currentReel.id}
            src={currentReel.videoUrl}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            onClick={(e) => {
              const v = e.target as HTMLVideoElement;
              if (v.paused) v.play();
              else v.pause();
            }}
          />

          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

          {/* Seller Info */}
          <div className="absolute top-12 left-4 z-20">
            <p className="text-white text-sm font-medium">
              {currentReel.seller?.seller_profiles?.store_name ?? "Unknown Seller"}
            </p>
          </div>

          {/* Caption */}
          {currentReel.caption && (
            <div className="absolute bottom-28 left-4 right-16 z-20">
              <p className="text-white text-sm leading-relaxed">
                {currentReel.caption}
              </p>
            </div>
          )}

          {/* Engagement Sidebar */}
          <div className="absolute bottom-28 right-4 z-20 flex flex-col items-center gap-4">
            {/* Like Button */}
            {token && (
              <button onClick={handleLikeToggle} className="flex flex-col items-center gap-1">
                <Heart
                  className={`h-6 w-6 transition-colors ${
                    likedMap[currentReel.id]
                      ? "fill-red-500 text-red-500"
                      : "text-white/80"
                  }`}
                />
                <span className="text-white/80 text-xs">
                  {likeCounts[currentReel.id] ?? currentReel.likes}
                </span>
              </button>
            )}
            {/* View Count */}
            <div className="flex flex-col items-center gap-1">
              <Eye className="h-5 w-5 text-white/80" />
              <span className="text-white/80 text-xs">{currentReel.views}</span>
            </div>
          </div>

          {/* Product Card Overlay */}
          {currentReel.product && (
            <div className="absolute bottom-4 left-4 right-4 z-20">
              <Link
                href={`/product/${currentReel.product.id}`}
                onClick={() => handleProductClick(currentReel.id)}
                className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:bg-white/15 transition-colors"
              >
                {/* Product Image */}
                {currentReel.product.images?.[0] && (
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 shrink-0">
                    <img
                      src={currentReel.product.images[0]}
                      alt={currentReel.product.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {currentReel.product.title}
                  </p>
                  <p className="text-white/80 text-sm font-semibold">
                    {currentReel.product.adminListingPrice
                      ? currency.format(currentReel.product.adminListingPrice)
                      : currency.format(currentReel.product.sellerPrice)}
                  </p>
                </div>

                {/* CTA */}
                <div className="shrink-0 flex items-center gap-1 text-white/90 text-xs font-medium bg-white/10 rounded-lg px-3 py-2">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  View
                </div>
              </Link>
            </div>
          )}
      </div>

      {/* Loading More Indicator */}
      {loadingMore && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <Loader2 className="h-5 w-5 animate-spin text-white/60" />
        </div>
      )}
    </div>
  );
}
