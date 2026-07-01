"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { quickStartImport, type QuickStartResult } from "@/app/dashboard/[id]/actions";
import { FontCombobox } from "@/components/font-combobox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: QuickStartResult = undefined;

const RADIUS_OPTIONS = [
  { value: "none", label: "Sharp (0px)" },
  { value: "sm", label: "Subtle (4px)" },
  { value: "md", label: "Default (8px)" },
  { value: "lg", label: "Rounded (16px)" },
  { value: "full", label: "Pill" },
];

const DEFAULT_FONT = "Inter";

export function QuickStartForm({
  designSystemId,
  currentPrimaryHex,
  currentSecondaryHex,
  currentFontName,
  currentRadius,
}: {
  designSystemId: string;
  currentPrimaryHex: string | null;
  currentSecondaryHex: string | null;
  currentFontName: string | null;
  currentRadius: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    quickStartImport.bind(null, designSystemId),
    initialState
  );

  const [primaryHex, setPrimaryHex] = useState(currentPrimaryHex ?? "#3b82f6");
  const [secondaryEnabled, setSecondaryEnabled] = useState(currentSecondaryHex !== null);
  const [secondaryHex, setSecondaryHex] = useState(currentSecondaryHex ?? "#8b5cf6");

  // Force the server component tree to re-render so the preview pane
  // picks up newly generated tokens.
  useEffect(() => {
    if (state && "success" in state) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Don't have a token file? Just tell us what you know — the rest is
        derived automatically (full color scales, dark mode, accessible
        text, typography, spacing).
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="primaryColor">Primary color</Label>
          <div className="flex items-center gap-2">
            <input
              id="primaryColor"
              name="primaryColor"
              type="color"
              value={primaryHex}
              onChange={(e) => setPrimaryHex(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent"
            />
            <span className="font-mono text-sm text-muted-foreground">{primaryHex}</span>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="secondaryColor">Secondary color</Label>
            <button
              type="button"
              onClick={() => setSecondaryEnabled((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {secondaryEnabled ? "Remove" : "+ Add secondary"}
            </button>
          </div>
          {secondaryEnabled ? (
            <div className="flex items-center gap-2">
              <input
                id="secondaryColor"
                name="secondaryColor"
                type="color"
                value={secondaryHex}
                onChange={(e) => setSecondaryHex(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border bg-transparent"
              />
              <span className="font-mono text-sm text-muted-foreground">{secondaryHex}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No secondary color.</p>
          )}
        </div>
      </div>

      <div className="grid gap-2 max-w-xs">
        <Label htmlFor="fontName">Font family</Label>
        <FontCombobox
          name="fontName"
          defaultValue={currentFontName ?? DEFAULT_FONT}
        />
        <p className="text-xs text-muted-foreground">
          Defaults to Inter — clean, legible, industry-standard for SaaS.
        </p>
      </div>

      <div className="grid gap-2 max-w-xs">
        <Label htmlFor="radius">Border radius feel</Label>
        <select
          id="radius"
          name="radius"
          defaultValue={currentRadius ?? "md"}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          {RADIUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Building your design system…" : "Create design system"}
        </Button>
        {state && "error" in state ? (
          <span className="text-sm text-destructive">{state.error}</span>
        ) : null}
        {state && "success" in state ? (
          <span className="text-sm text-muted-foreground">Done.</span>
        ) : null}
      </div>
    </form>
  );
}
