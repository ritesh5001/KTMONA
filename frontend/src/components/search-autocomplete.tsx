"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { getSuggestions, type SuggestionItem } from "@/services/search";
import { startNavigationFeedback } from "@/lib/navigation-feedback";

interface SearchAutocompleteProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

export function SearchAutocomplete({
  defaultValue = "",
  placeholder = "Search collections, styles...",
  className,
}: SearchAutocompleteProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(defaultValue);
  const [suggestions, setSuggestions] = React.useState<SuggestionItem[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    router.prefetch("/marketplace");
  }, [router]);

  const fetchSuggestions = React.useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const items = await getSuggestions(q);
      setSuggestions(items);
      setOpen(items.length > 0);
    } catch {
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(value.trim()), 300);
    },
    [fetchSuggestions]
  );

  const handleSubmit = React.useCallback(
    (searchTerm?: string) => {
      const term = (searchTerm ?? query).trim();
      setOpen(false);
      if (!term) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("search", term);
      params.delete("page");
      startNavigationFeedback();
      router.push(`/marketplace?${params.toString()}`);
    },
    [query, router, searchParams]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [handleSubmit]
  );

  const handleSuggestionClick = React.useCallback(
    (item: SuggestionItem) => {
      setQuery(item.title);
      handleSubmit(item.title);
    },
    [handleSubmit]
  );

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <Input
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        aria-label="Search products"
        autoComplete="off"
      />

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full border border-border-soft bg-card shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-mist dark:hover:bg-navy/20 transition-colors flex items-center justify-between gap-2"
                onClick={() => handleSuggestionClick(item)}
              >
                <span className="text-foreground truncate">{item.title}</span>
                {item.category && (
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
                    {item.category}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
    </div>
  );
}
