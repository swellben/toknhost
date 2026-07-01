"use client";

import type { CSSProperties } from "react";

/**
 * Real Tailwind v4 utility-class rendering of a design system — uses literal
 * classes (bg-primary-500, text-xs, shadow-md, etc.) that this app's own
 * globals.css generates utilities for (see the placeholder @theme block
 * there), then overrides the underlying CSS variables on a scoped wrapper so
 * those utilities pick up the design system's actual values. Same
 * CSS-variable-override mechanism already proven for the shadcn preview, but
 * exercising the broader 26-category `tailwind-v4` namespace directly
 * instead of shadcn's narrower 33-slot layer.
 */
export function TailwindV4FrameworkPreview({
  variables,
}: {
  variables: Record<string, string> | null;
}) {
  if (!variables || Object.keys(variables).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Import tokens and run gap-fill (Details tab) to see a live preview.
      </p>
    );
  }

  // Unlike the shadcn-shaped MCP output (bare names like "primary"), the
  // tailwind-v4 namespace already returns keys with the "--" prefix
  // (e.g. "--color-primary-500") — use them as-is to override the app's
  // placeholder theme variables locally, scoped to this wrapper only.
  const overrideStyle: CSSProperties = Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [
      key.startsWith("--") ? key : `--${key}`,
      value,
    ])
  ) as CSSProperties;

  return (
    <div
      style={overrideStyle}
      className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 text-foreground"
    >
      <div className="flex flex-wrap gap-2">
        <button className="rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white shadow-sm">
          Primary
        </button>
        <button className="rounded-md bg-secondary-500 px-4 py-2 text-sm font-medium text-white shadow-sm">
          Secondary
        </button>
        <button className="rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground">
          Outline
        </button>
        <button className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white shadow-sm">
          Destructive
        </button>
      </div>

      <div className="rounded-lg border border-border bg-muted p-4 shadow-md">
        <p className="text-lg font-semibold text-foreground">Account settings</p>
        <p className="text-sm text-muted-foreground">Real Tailwind v4 utility classes, not inline styles.</p>
        <div className="mt-3 flex flex-col gap-2">
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="you@example.com"
            readOnly
          />
          <div className="flex gap-2">
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
              Active
            </span>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
              Success
            </span>
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
              Warning
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-3xl font-bold">Display heading</p>
        <p className="text-xl font-semibold">Section heading</p>
        <p className="text-sm text-muted-foreground">Small / caption text, via text-sm.</p>
      </div>
    </div>
  );
}
