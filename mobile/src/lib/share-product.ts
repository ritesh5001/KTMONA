/**
 * Meesho-style product sharing: WhatsApp with the price and link, the product
 * photo through the system share sheet, or plain text to any app. Every share
 * is remembered in Account → Shared Products.
 */

import { Linking, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { rememberProduct } from "./local-lists";
import { translate } from "../i18n";

const WEB_BASE = "https://www.ktmona.com";

export interface ShareableProduct {
  id: string;
  title: string;
  image: string | null;
  price: number | null;
  regularPrice?: number | null;
}

export function productLink(id: string) {
  return `${WEB_BASE}/product/${id}`;
}

function caption(p: ShareableProduct) {
  const price = p.price != null ? `₹${Math.round(p.price).toLocaleString("en-IN")}` : "";
  const mrp = p.regularPrice != null && p.price != null && p.regularPrice > p.price ? ` (MRP ₹${Math.round(p.regularPrice).toLocaleString("en-IN")})` : "";
  return `${p.title}\n${price}${mrp}\n\n${translate("Shop on KTMONA")}: ${productLink(p.id)}`;
}

function remember(p: ShareableProduct) {
  void rememberProduct("shared", { id: p.id, title: p.title, image: p.image, price: p.price, regularPrice: p.regularPrice ?? null });
}

/**
 * Open WhatsApp with the product name, price and link. Uses the wa.me link,
 * which opens the WhatsApp app when installed (and WhatsApp Web otherwise)
 * without needing package-visibility permissions on Android 11+.
 */
export async function shareOnWhatsApp(p: ShareableProduct): Promise<void> {
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(caption(p))}`);
  remember(p);
}

/** Share the product photo (the share sheet lets the shopper pick WhatsApp, Instagram…). */
export async function sharePhoto(p: ShareableProduct): Promise<void> {
  if (!p.image || !(await Sharing.isAvailableAsync())) {
    await shareText(p);
    return;
  }
  const ext = /\.(png|webp|jpe?g)(\?|$)/i.exec(p.image)?.[1]?.toLowerCase() ?? "jpg";
  const target = `${FileSystem.cacheDirectory ?? ""}ktmona-share-${p.id}.${ext === "jpeg" ? "jpg" : ext}`;
  const { uri } = await FileSystem.downloadAsync(p.image, target);
  await Sharing.shareAsync(uri, {
    dialogTitle: p.title,
    mimeType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
  });
  remember(p);
}

/** Plain text + link to any app. */
export async function shareText(p: ShareableProduct): Promise<void> {
  const result = await Share.share({ message: caption(p) });
  if (result.action === Share.sharedAction) remember(p);
}
