"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { GOOGLE_FONTS } from "@/lib/google-fonts";

// Render a page of names at a time and append on scroll — keeps the DOM small
// against the ~1,900-font catalog. Only names render here (no per-option font
// loading), so opening the list never fetches font files.
const PAGE_SIZE = 50;
const SCROLL_THRESHOLD_PX = 48;

export function FontPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? GOOGLE_FONTS.filter((f) => f.toLowerCase().includes(q)) : GOOGLE_FONTS;
  }, [query]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    listRef.current?.scrollTo({ top: 0 });
  }, [query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const shown = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function onScroll() {
    const el = listRef.current;
    if (!el || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD_PX) {
      setVisibleCount((v) => Math.min(v + PAGE_SIZE, filtered.length));
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/60"
      >
        <span className="truncate">{value || "Choose a font…"}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <div className="p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 1,900+ fonts…"
              className="h-8 text-sm"
            />
          </div>
          <div ref={listRef} onScroll={onScroll} className="max-h-64 overflow-y-auto">
            {shown.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No fonts match.
              </p>
            ) : (
              shown.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    onSelect(f);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted",
                    value === f && "bg-muted/60"
                  )}
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      value === f ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{f}</span>
                </button>
              ))
            )}
            {hasMore && (
              <p className="px-3 py-1.5 text-center text-xs text-muted-foreground">
                Scroll for more…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
