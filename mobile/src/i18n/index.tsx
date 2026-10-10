/**
 * App language (English / Hindi), Meesho-style.
 *
 * English text is the key: `t("My Orders")` returns the Hindi string when
 * Hindi is selected, or the English text unchanged (also the fallback for any
 * string not yet in the dictionary). Product names, descriptions and other
 * seller-written content are never translated.
 *
 * The shared text components (`T`, the drop-in `Text`, buttons, headers)
 * translate their string children automatically, so most screens need no
 * per-string changes. Use `t()` directly for alerts, toasts and placeholders.
 */

import * as React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HI } from "./hi";

export type Lang = "en" | "hi";

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];

const STORAGE_KEY = "ktmona.language";

/** Module-level copy so `translate()` works outside React (alerts, helpers). */
let currentLang: Lang = "en";

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/** Translate one English string for the given language. */
export function translateTo(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  if (lang === "en" || !text) return interpolate(text, vars);
  // Keep surrounding whitespace ("Order " + id) while looking up the words.
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const [, lead = "", core = text, trail = ""] = match ?? [];
  const hit = HI[core];
  return hit === undefined ? interpolate(text, vars) : lead + interpolate(hit, vars) + trail;
}

/** Translate using the currently selected language (for non-component code). */
export function translate(text: string, vars?: Record<string, string | number>): string {
  return translateTo(currentLang, text, vars);
}

/** Translate string children (or string items in a children array). */
export function translateChildren(lang: Lang, children: React.ReactNode): React.ReactNode {
  if (lang === "en") return children;
  if (typeof children === "string") return translateTo(lang, children);
  if (Array.isArray(children)) {
    return children.map((c) => (typeof c === "string" ? translateTo(lang, c) : c));
  }
  return children;
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (text: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = React.createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => undefined,
  t: (text, vars) => interpolate(text, vars),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("en");

  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "hi" || saved === "en") {
          currentLang = saved;
          setLangState(saved);
        }
      })
      .catch(() => undefined);
  }, []);

  const setLang = React.useCallback((next: Lang) => {
    currentLang = next;
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = React.useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t: (text, vars) => translateTo(lang, text, vars) }),
    [lang, setLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return React.useContext(LanguageContext);
}

/** Shorthand: `const t = useT(); t("My Orders")`. */
export function useT() {
  return React.useContext(LanguageContext).t;
}
