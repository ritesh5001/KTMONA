"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const storageKey = "ktmona-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    const stored = window.localStorage.getItem(storageKey);
    const nextIsDark = stored === "dark";
    setIsDark(nextIsDark);
    root.classList.toggle("dark", nextIsDark);
    root.style.colorScheme = nextIsDark ? "dark" : "light";
  }, []);

  const toggleTheme = React.useCallback(() => {
    const root = document.documentElement;
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);
    window.localStorage.setItem(storageKey, nextIsDark ? "dark" : "light");
    root.classList.toggle("dark", nextIsDark);
    root.style.colorScheme = nextIsDark ? "dark" : "light";
  }, [isDark]);

  return (
    <button
      type="button"
      className={cn(
        "h-9 w-9 flex items-center justify-center border border-border-soft bg-card text-muted-foreground transition-all duration-300 hover:bg-mist hover:text-foreground dark:hover:bg-navy/50",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
    >
      {mounted && isDark ? (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z" />
        </svg>
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
