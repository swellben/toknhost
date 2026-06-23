"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { GOOGLE_FONTS } from "@/lib/google-fonts";

// How many results render initially, and how many more get appended each
// time the user scrolls near the bottom — keeps the DOM small at any
// given moment regardless of the ~1900-font catalog, while still letting
// someone scroll all the way through it if they want to browse rather
// than search.
const PAGE_SIZE = 50;
const SCROLL_THRESHOLD_PX = 48;

/**
 * A plain, self-contained searchable dropdown — no Popover/Command
 * primitives. Those (Base UI's Popover + cmdk's Command, as installed by
 * this project's `shadcn` setup) repeatedly produced an unstyled,
 * transparent, unbounded-height panel here that resisted fixing through
 * their own className/data-attribute APIs. Per-font live preview was
 * dropped too (no IntersectionObserver/webfont loading) — it's not worth
 * the added surface area for a font picker. This trades a little
 * polish for something that reliably renders correctly.
 */
export function FontCombobox({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState(defaultValue || GOOGLE_FONTS[0]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync when the server delivers a new saved value after router.refresh()
  useEffect(() => {
    if (defaultValue) setValue(defaultValue);
  }, [defaultValue]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? GOOGLE_FONTS.filter((f) => f.toLowerCase().includes(q)) : GOOGLE_FONTS;
  }, [query]);

  // Reset to the first page whenever the search narrows/changes — the
  // previous scroll position's "load more" progress doesn't apply to a
  // different result set.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    listRef.current?.scrollTo({ top: 0 });
  }, [query]);

  const shown = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasMore) return;
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD_PX;
    if (nearBottom) {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
    }
  }

  function selectFont(font: string) {
    setValue(font);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-64">
      <input type="hidden" name={name} value={value} />
      <Input
        value={open ? query : value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          // Let a click on an option register before we close — option
          // clicks use onMouseDown (fires first) to select, so this is
          // just a fallback for clicking fully outside.
          setTimeout(() => setOpen(false), 100);
        }}
        placeholder="Search fonts…"
        autoComplete="off"
        spellCheck={false}
      />

      {open && (
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {shown.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No fonts found.</p>
          ) : (
            <>
              {shown.map((font) => (
                <button
                  key={font}
                  type="button"
                  title=""
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus from leaving before we handle the click
                    selectFont(font);
                  }}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  {font}
                  {font === value && <Check className="size-4 shrink-0" />}
                </button>
              ))}
              {hasMore && (
                <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                  Scroll for more ({filtered.length - visibleCount} left)
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
