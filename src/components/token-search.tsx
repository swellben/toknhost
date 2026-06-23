"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { searchTokens, type TokenSearchResult } from "@/app/dashboard/[id]/search-actions";

/** Resolves the current design system id from the URL — null on the
 * design-systems list, settings, or anywhere else search doesn't apply. */
function useCurrentDesignSystemId(): string | null {
  const pathname = usePathname();
  const match = /^\/dashboard\/([^/]+)$/.exec(pathname);
  if (!match || match[1] === "settings") return null;
  return match[1];
}

export function TokenSearch() {
  const designSystemId = useCurrentDesignSystemId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!designSystemId || !query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const matches = await searchTokens(designSystemId, query);
      setResults(matches);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [designSystemId, query]);

  const placeholder = designSystemId
    ? "Search tokens…"
    : "Open a design system to search its tokens";

  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        disabled={!designSystemId}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        placeholder={placeholder}
        className="h-10 w-full rounded-full border bg-background pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
      />

      {open && query.trim() && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matching tokens.</p>
          ) : (
            results.map((r) => (
              <Link
                key={r.path}
                href={`/dashboard/${designSystemId}?tab=${r.tab}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery("");
                  setOpen(false);
                }}
                className="flex items-center justify-between rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="font-mono">{r.path}</span>
                <span className="text-xs text-muted-foreground">{r.category}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
