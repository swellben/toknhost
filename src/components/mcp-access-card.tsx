"use client";

import { useState } from "react";
import { regenerateMcpToken } from "@/app/dashboard/[id]/mcp-actions";
import { Button } from "@/components/ui/button";

// Mirrors the `framework` enum exposed by the MCP server's get_tokens/
// get_theme tools and its GET ?framework= route — see
// supabase/functions/design-system-mcp/index.ts.
// figma-variables is deferred to V2 — see PIVOT-PLAN.md.
const FRAMEWORKS = ["tailwind-v4", "shadcn", "tailwind-v3", "css-variables", "dtcg", "bootstrap"];

export function McpAccessCard({
  designSystemId,
  endpointUrl,
  isPublic,
  mcpToken,
  defaultFramework,
  modeNames,
}: {
  designSystemId: string;
  endpointUrl: string;
  isPublic: boolean;
  mcpToken: string;
  defaultFramework: string;
  modeNames: string[];
}) {
  const [token, setToken] = useState(mcpToken);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<"url" | "token" | "direct" | null>(null);
  const [framework, setFramework] = useState(defaultFramework);
  const [mode, setMode] = useState<string>("");

  const directUrl = `${endpointUrl}?framework=${framework}${mode ? `&mode=${mode}` : ""}`;

  async function handleRegenerate() {
    if (!confirm("Regenerate this token? Anything using the old one will stop working immediately.")) {
      return;
    }
    setPending(true);
    const result = await regenerateMcpToken(designSystemId);
    setPending(false);
    if (result && "token" in result) setToken(result.token);
  }

  function copy(value: string, which: "url" | "token" | "direct") {
    navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        This is a live MCP server — point an AI coding agent (Claude,
        Cursor, etc.) at this URL and it will receive this design
        system&apos;s tokens, shaped for the configured framework, with
        explicit usage rules baked into every response.
      </p>

      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm">
          {endpointUrl}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={() => copy(endpointUrl, "url")}>
          {copied === "url" ? "Copied" : "Copy"}
        </Button>
      </div>

      {isPublic ? (
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
            <Button type="button" variant="outline" size="sm" onClick={() => setRevealed((r) => !r)}>
              {revealed ? "Hide" : "Reveal"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => copy(token, "token")}>
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
          Prefer a plain URL over MCP? Pick a framework and mode below to get
          a direct link — works with anything that can <code>fetch()</code>{" "}
          JSON (vibe-coding tools without MCP support, or just pasting the
          URL into a prompt). Returns the same tokens, no JSON-RPC envelope.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            {FRAMEWORKS.map((fw) => (
              <option key={fw} value={fw}>{fw}</option>
            ))}
          </select>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">All modes (full theme)</option>
            {modeNames.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm">
            {directUrl}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={() => copy(directUrl, "direct")}>
            {copied === "direct" ? "Copied" : "Copy"}
          </Button>
        </div>
        {!isPublic && (
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
