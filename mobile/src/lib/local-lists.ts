/**
 * On-device product lists, Meesho-style:
 *  - Recently Viewed: the last products opened (shown on Home and Account).
 *  - Shared Products: everything the shopper shared to WhatsApp & co.
 *
 * Both live in AsyncStorage so they work signed-out and offline. Each entry
 * is a small snapshot (title, image, price) so the lists render without a
 * network round-trip; opening one loads the live product.
 */

import * as React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SavedProduct {
  id: string;
  title: string;
  image: string | null;
  price: number | null;
  regularPrice?: number | null;
  /** When it was viewed / shared (ms since epoch). */
  at: number;
}

type ListName = "recent" | "shared";

const KEYS: Record<ListName, string> = {
  recent: "ktmona.recentlyViewed",
  shared: "ktmona.sharedProducts",
};
const MAX: Record<ListName, number> = { recent: 30, shared: 100 };

const listeners = new Set<() => void>();
const cache: Partial<Record<ListName, SavedProduct[]>> = {};

async function read(list: ListName): Promise<SavedProduct[]> {
  if (cache[list]) return cache[list]!;
  try {
    const raw = await AsyncStorage.getItem(KEYS[list]);
    cache[list] = raw ? (JSON.parse(raw) as SavedProduct[]) : [];
  } catch {
    cache[list] = [];
  }
  return cache[list]!;
}

async function write(list: ListName, items: SavedProduct[]) {
  cache[list] = items;
  listeners.forEach((fn) => fn());
  await AsyncStorage.setItem(KEYS[list], JSON.stringify(items)).catch(() => undefined);
}

/** Put a product at the top of a list (moving it if already there). */
export async function rememberProduct(list: ListName, product: Omit<SavedProduct, "at">) {
  const items = await read(list);
  const next = [{ ...product, at: Date.now() }, ...items.filter((p) => p.id !== product.id)].slice(0, MAX[list]);
  await write(list, next);
}

export async function forgetProduct(list: ListName, id: string) {
  const items = await read(list);
  await write(list, items.filter((p) => p.id !== id));
}

export async function clearList(list: ListName) {
  await write(list, []);
}

/** Live view of a list; re-renders when it changes anywhere in the app. */
export function useSavedProducts(list: ListName): SavedProduct[] {
  const [items, setItems] = React.useState<SavedProduct[]>(cache[list] ?? []);
  React.useEffect(() => {
    let alive = true;
    const sync = () => {
      void read(list).then((v) => {
        if (alive) setItems(v);
      });
    };
    sync();
    listeners.add(sync);
    return () => {
      alive = false;
      listeners.delete(sync);
    };
  }, [list]);
  return items;
}
