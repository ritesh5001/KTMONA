import * as React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Image } from "expo-image";

/**
 * Release decoded image memory when the app is not on screen.
 *
 * expo-image keeps every image it has shown in two caches: a disk cache of the
 * encoded bytes, and a memory cache of the *decoded* bitmap. The decoded copy is
 * the expensive one — a single 828px product photo is several megabytes once
 * expanded, regardless of how few kilobytes it took to download.
 *
 * Nothing in this app ever released that memory. A shopper browsing a hundred
 * products accumulated a hundred decoded bitmaps, and once the heap filled the
 * garbage collector began running constantly — which is felt as the whole app
 * stuttering, on capable phones as much as cheap ones, and only after a while.
 *
 * Backgrounding is the natural moment to let go: nothing is visible, so nothing
 * needs to stay decoded. Only the memory cache is cleared — the disk cache is
 * deliberately kept, so returning re-decodes from local storage rather than
 * re-downloading. The shopper sees images appear as normal; the heap starts
 * clean.
 */
export function useImageMemoryRelease(): void {
  React.useEffect(() => {
    const handleChange = (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        // Fire-and-forget: if this fails the only cost is memory we would have
        // held anyway, and it must never delay backgrounding.
        void Image.clearMemoryCache().catch(() => undefined);
      }
    };

    const subscription = AppState.addEventListener("change", handleChange);
    return () => subscription.remove();
  }, []);
}
