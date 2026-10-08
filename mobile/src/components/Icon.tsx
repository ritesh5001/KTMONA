import * as React from "react";
import { Feather, Ionicons } from "@expo/vector-icons";
import type { StyleProp, TextStyle } from "react-native";

/**
 * The app's single icon language.
 *
 * Before this, the same idea was drawn three different ways: `heart` came from
 * Feather in one card and Ionicons in another, `menu` from both, and a Material
 * `grid-view` sat next to Ionicons outlines in the same bar. Three families
 * means three stroke weights, three corner treatments and three optical sizes
 * on one screen — which is the thing that actually reads as unfinished, far more
 * than any individual glyph does.
 *
 * Feather is the house set: a uniform thin stroke, geometric construction, no
 * decorative flourish. It is the closest of the bundled fonts to the editorial
 * line work luxury retail uses. Ionicons' outline variants fill the handful of
 * gaps — sparkles, shirt, scan — where Feather has no equivalent and where a
 * near-match would read worse than a considered substitute.
 *
 * Everything routes through the map below, so restyling the whole app's
 * iconography later is a single-file edit rather than another 80-site sweep.
 */

type FeatherName = React.ComponentProps<typeof Feather>["name"];
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type Glyph =
  | { set: "feather"; glyph: FeatherName }
  | { set: "ionicons"; glyph: IoniconName };

const f = (glyph: FeatherName): Glyph => ({ set: "feather", glyph });
const i = (glyph: IoniconName): Glyph => ({ set: "ionicons", glyph });

/**
 * Keys are the names already used across the app, so every call site keeps
 * reading the way it did — only the drawing changes. New code should prefer the
 * short semantic aliases at the bottom.
 */
const ICONS = {
  // ---- Navigation ----
  menu: f("menu"),
  close: f("x"),
  "chevron-forward": f("chevron-right"),
  "chevron-back": f("chevron-left"),
  "chevron-up": f("chevron-up"),
  "chevron-down": f("chevron-down"),
  "arrow-right": f("arrow-right"),
  "arrow-up": f("arrow-up"),
  "home-outline": f("home"),
  home: f("home"),

  // ---- Commerce ----
  "bag-handle-outline": f("shopping-bag"),
  "bag-handle": f("shopping-bag"),
  "shopping-bag": f("shopping-bag"),
  "cart-outline": f("shopping-cart"),
  cart: f("shopping-cart"),
  "pricetag-outline": f("tag"),
  "receipt-outline": f("file-text"),
  "cube-outline": f("package"),
  "card-outline": f("credit-card"),

  // ---- Wishlist ----
  heart: f("heart"),
  "heart-outline": f("heart"),

  // ---- Discovery ----
  "search-outline": f("search"),
  search: f("search"),
  "grid-view": f("grid"),
  grid: f("grid"),
  "funnel-outline": f("filter"),
  "swap-vertical-outline": f("sliders"),
  "options-outline": f("sliders"),

  // ---- Media ----
  "play-circle-outline": f("play-circle"),
  "videocam-outline": f("video"),
  "camera-outline": f("camera"),
  "image-outline": f("image"),
  "eye-outline": f("eye"),
  "eye-off-outline": f("eye-off"),

  // ---- Account ----
  "person-outline": f("user"),
  person: f("user"),
  user: f("user"),
  "person-add-outline": f("user-plus"),
  "log-in-outline": f("log-in"),
  "log-out-outline": f("log-out"),
  "headset-outline": f("headphones"),
  headphones: f("headphones"),
  "notifications-outline": f("bell"),
  "location-outline": f("map-pin"),
  "settings-outline": f("settings"),

  // ---- Trust & status ----
  "shield-checkmark-outline": f("shield"),
  award: f("award"),
  "ribbon-outline": f("award"),
  "checkmark-circle": f("check-circle"),
  checkmark: f("check"),
  "refresh-outline": f("refresh-cw"),
  "document-text-outline": f("file-text"),
  "alert-circle-outline": f("alert-circle"),
  "information-circle-outline": f("info"),
  "lock-closed-outline": f("lock"),
  "lock-open-outline": f("unlock"),
  "help-circle-outline": f("help-circle"),
  "calendar-outline": f("calendar"),
  "time-outline": f("clock"),
  "call-outline": f("phone"),
  "mail-outline": f("mail"),
  "trash-outline": f("trash-2"),
  add: f("plus"),
  plus: f("plus"),
  remove: f("minus"),
  minus: f("minus"),
  send: f("send"),
  "share-social-outline": f("share-2"),
  share: f("share-2"),

  // ---- Voice, chat, sound ----
  mic: f("mic"),
  "mic-outline": f("mic"),
  "mic-off": f("mic-off"),
  "chatbubble-ellipses-outline": f("message-circle"),
  "chatbubble-outline": f("message-circle"),
  "volume-high-outline": f("volume-2"),
  "volume-mute-outline": f("volume-x"),

  // Feather names the horizontal chevrons left/right; both spellings resolve
  // here so call sites can use whichever reads better in context.
  "chevron-right": f("chevron-right"),
  "chevron-left": f("chevron-left"),

  // Feather has no plane; `send` is the paper aeroplane and reads as shipping.
  "airplane-outline": f("send"),

  // ---- No Feather equivalent worth faking ----
  // Sparkles carries the "virtual try-on" and "new" flourishes; Feather's
  // nearest is a generic star, which loses the meaning entirely.
  "sparkles-outline": i("sparkles-outline"),
  sparkles: i("sparkles-outline"),
  "shirt-outline": i("shirt-outline"),
  "scan-outline": i("scan-outline"),
  star: f("star"),
} as const;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Optical sizing: Feather's glyphs sit on a 24px grid with a lot of internal
 * padding, so at the same nominal size they read noticeably smaller than the
 * Ionicons they replace. Nudging them up keeps a header icon looking the same
 * weight as it did before the swap.
 */
const FEATHER_OPTICAL_SCALE = 1.08;

export const Icon = React.memo(function Icon({
  name,
  size = 20,
  color = "#0C1B42",
  style,
}: IconProps) {
  const entry = ICONS[name];

  if (!entry) {
    if (__DEV__) {
      console.warn(`[Icon] unknown name "${name}" — add it to the map in Icon.tsx`);
    }
    return null;
  }

  if (entry.set === "feather") {
    return (
      <Feather
        name={entry.glyph}
        size={Math.round(size * FEATHER_OPTICAL_SCALE)}
        color={color}
        style={style}
      />
    );
  }

  return <Ionicons name={entry.glyph} size={size} color={color} style={style} />;
});

/** True when a name is in the map — for call sites building names dynamically. */
export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, value);
}
