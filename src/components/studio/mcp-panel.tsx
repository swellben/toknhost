"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getStudioMcpAccess,
  regenerateStudioMcpToken,
  type StudioMcpAccess,
} from "@/app/studio/mcp-actions";
import { Button } from "@/components/ui/button";

// Mirrors the `framework` enum exposed by the MCP server's get_tokens/
// get_theme tools and its GET ?framework= route — see
// supabase/functions/design-system-mcp/index.ts.
const FRAMEWORKS = [
  "tailwind-v4",
  "shadcn",
  "tailwind-v3",
  "css-variables",
  "dtcg",
  "bootstrap",
];

/**
 * The studio's MCP handoff view. Given the currently-loaded design system,
 * fetches its live endpoint via `getStudioMcpAccess` (which gates on the
 * caller's plan) and renders one of: a "save first" empty state (no saved
 * system), an upgrade prompt (owned but not entitled), or the connection card
 * (URL + bearer token + direct-fetch link). Studio-native adaptation of the
 * dashboard's `McpAccessCard`.
 */
export function McpPanel({ designSystemId }: { designSystemId: string | null }) {
  const [access, setAccess] = useState<StudioMcpAccess | null>(null);
  // The id `access` was fetched for, so a stale result from a previous system
  // is never shown while a new fetch is in flight (or after switching to a
  // draft with no id) — cheaper than resetting state inside the effect.
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (!designSystemId) return;
    let cancelled = false;
    getStudioMcpAccess(designSystemId).then((result) => {
      if (cancelled) return;
      setAccess(result);
      setLoadedId(designSystemId);
    });
    return () => {
      cancelled = true;
    };
  }, [designSystemId]);

  const current =
    designSystemId && loadedId === designSystemId ? access : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold">MCP endpoint</h2>
          <p className="text-xs text-muted-foreground">
            Serve this design system&apos;s tokens to an AI coding agent over a
            live MCP server, or a plain fetchable URL.
          </p>
        </div>

        {!designSystemId ? (
          <EmptyState />
        ) : !current ? (
          <p className="text-sm text-muted-foreground">Loading endpoint…</p>
        ) : current.status === "error" ? (
          <p className="text-sm text-destructive">{current.message}</p>
        ) : current.status === "locked" ? (
          <LockedState />
        ) : (
          <ConnectionCard designSystemId={designSystemId} access={current} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
      Save this theme to your account to get a live MCP endpoint. Name it from
      the switcher up top — once it&apos;s saved, its connection details show up
      here.
    </div>
  );
}

function LockedState() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-6">
      <p className="text-sm font-medium">MCP access is a premium feature</p>
      <p className="text-sm text-muted-foreground">
        Start your 7-day free trial to serve this design system to your AI
        agents over a live MCP endpoint.
      </p>
      {/* Wired to Stripe checkout next (LAUNCH-PLAN.md Phase 3, step 5). */}
      <Button type="button" size="sm" className="w-fit" disabled>
        Start free trial
      </Button>
    </div>
  );
}

function ConnectionCard({
  designSystemId,
  access,
}: {
  designSystemId: string;
  access: Extract<StudioMcpAccess, { status: "ok" }>;
}) {
  const [token, setToken] = useState(access.mcpToken);
  const [revealed, setRevealed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<"url" | "token" | "direct" | null>(null);
  const [framework, setFramework] = useState(access.defaultFramework);
  const [mode, setMode] = useState("");

  const directUrl = `${access.endpointUrl}?framework=${framework}${
    mode ? `&mode=${mode}` : ""
  }`;

  function handleRegenerate() {
    if (
      !confirm(
        "Regenerate this token? Anything using the old one will stop working immediately."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await regenerateStudioMcpToken(designSystemId);
      if ("token" in result) setToken(result.token);
    });
  }

  function copy(value: string, which: "url" | "token" | "direct") {
    navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        This is a live MCP server — point an AI coding agent (Claude, Cursor,
        etc.) at this URL and it will receive this design system&apos;s tokens,
        shaped for the configured framework, with explicit usage rules baked
        into every response.
      </p>

      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm">
          {access.endpointUrl}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copy(access.endpointUrl, "url")}
        >
          {copied === "url" ? "Copied" : "Copy"}
        </Button>
      </div>

      {access.isPublic ? (
        <p className="text-xs text-muted-foreground">
          Public — no token needed, anyone with the URL can connect.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Private — connecting agents need this bearer token in an{" "}
            <code>Authorization: Bearer &lt;token&gt;</code> header.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm">
              {revealed ? token : "•".repeat(20)}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? "Hide" : "Reveal"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copy(token, "token")}
            >
              {copied === "token" ? "Copied" : "Copy"}
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit text-muted-foreground hover:text-destructive"
            onClick={handleRegenerate}
            disabled={pending}
          >
            {pending ? "Regenerating…" : "Regenerate token"}
          </Button>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-2 border-t pt-3">
        <p className="text-sm text-muted-foreground">
          Prefer a plain URL over MCP? Pick a framework and mode below to get a
          direct link — works with anything that can <code>fetch()</code> JSON
          (vibe-coding tools without MCP support, or just pasting the URL into a
          prompt). Returns the same tokens, no JSON-RPC envelope.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            {FRAMEWORKS.map((fw) => (
              <option key={fw} value={fw}>
                {fw}
              </option>
            ))}
          </select>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">All modes (full theme)</option>
            {access.modeNames.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm">
            {directUrl}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copy(directUrl, "direct")}
          >
            {copied === "direct" ? "Copied" : "Copy"}
          </Button>
        </div>
        {!access.isPublic && (
          <p className="text-xs text-muted-foreground">
            Private — this URL also needs the bearer token above in an{" "}
            <code>Authorization</code> header; it won&apos;t work pasted bare
            into a browser.
          </p>
        )}
      </div>
    </div>
  );
}
