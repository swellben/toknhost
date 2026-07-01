"use client";

import { useState } from "react";
import { DesignSystemPreview } from "@/components/design-system-preview";
import { ShadcnFrameworkPreview } from "@/components/shadcn-framework-preview";
import { TailwindV4FrameworkPreview } from "@/components/tailwind-v4-framework-preview";
import { useTheme, type ThemeByMode } from "@/components/theme-context";

// Font/typography tokens are not mode-specific — they should be identical in
// every mode. If dark mode variables happen to be missing them (e.g. because
// they were only written under the light mode key), borrow from any mode that
// has them so the preview always renders the correct typeface.
const SHARED_VARS = [
  "--font-family-base", "--font-size-base", "--font-size-sm", "--font-size-lg", "--font-size-xl", "--font-size-2xl",
  "--border-radius-base",  // mode-agnostic — dark mode must inherit from donor
];

function withSharedVars(byMode: ThemeByMode, activeMode: string): Record<string, string> {
  const active = byMode[activeMode]?.variables ?? {};
  const donor = Object.values(byMode).find((m) => m.variables["--font-family-base"]);
  if (!donor) return active;
  const merged: Record<string, string> = { ...active };
  // Font tokens are mode-agnostic — always use the donor's value so a stale
  // dark-mode entry (from an earlier run with a different font) doesn't win.
  for (const key of SHARED_VARS) {
    if (donor.variables[key]) merged[key] = donor.variables[key];
  }
  return merged;
}

// Frameworks with a real-component preview implementation. Pass 1 covers
// these three (all pure CSS-variable, no build step needed); Bootstrap and
// Tailwind v3 need real Sass/config compilation and are a deferred
// fast-follow — see PIVOT-PLAN.md "Visual preview per target framework".
const PREVIEW_FRAMEWORKS = [
  { id: "css-variables", label: "Generic" },
  { id: "tailwind-v4", label: "Tailwind v4" },
  { id: "shadcn", label: "shadcn" },
] as const;

export function DesignSystemPreviewPanel({
  defaultMode,
  shadcnByMode,
  tailwindV4ByMode,
}: {
  defaultMode: string;
  shadcnByMode: ThemeByMode | null;
  tailwindV4ByMode: ThemeByMode | null;
}) {
  const { byMode } = useTheme();
  const modeNames = byMode ? Object.keys(byMode) : [];

  const [preferredMode, setPreferredMode] = useState<string | null>(null);
  const [framework, setFramework] = useState<(typeof PREVIEW_FRAMEWORKS)[number]["id"]>(
    "css-variables"
  );

  const activeMode =
    (preferredMode && byMode?.[preferredMode] ? preferredMode : null) ??
    (byMode?.[defaultMode] ? defaultMode : null) ??
    modeNames[0] ??
    null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Live preview</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-md bg-muted p-1">
            {PREVIEW_FRAMEWORKS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFramework(f.id)}
                className={`rounded-sm px-2 py-1 text-xs ${
                  framework === f.id
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {modeNames.length > 1 && (
            <div className="flex gap-1 rounded-md bg-muted p-1">
              {modeNames.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPreferredMode(m)}
                  className={`rounded-sm px-2 py-1 text-xs capitalize ${
                    activeMode === m
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {framework === "shadcn" ? (
        <ShadcnFrameworkPreview
          variables={activeMode && shadcnByMode ? shadcnByMode[activeMode]?.variables ?? null : null}
        />
      ) : framework === "tailwind-v4" ? (
        <TailwindV4FrameworkPreview
          variables={activeMode && tailwindV4ByMode ? tailwindV4ByMode[activeMode]?.variables ?? null : null}
        />
      ) : (
        <DesignSystemPreview
          variables={activeMode && byMode ? withSharedVars(byMode, activeMode) : null}
        />
      )}
    </div>
  );
}
