"use client";

import { useActionState, useState } from "react";
import {
  setFontFamily,
  setTypeScale,
  type TypographyActionResult,
} from "@/app/dashboard/[id]/typography-actions";
import { FontCombobox } from "@/components/font-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: TypographyActionResult = undefined;

export function TypographyCard({
  designSystemId,
  currentFontName,
  currentBaseSize,
}: {
  designSystemId: string;
  currentFontName: string | null;
  currentBaseSize: number | null;
}) {
  const [source, setSource] = useState<"google" | "custom">("google");
  const [fontState, fontAction, fontPending] = useActionState(
    setFontFamily.bind(null, designSystemId),
    initialState
  );
  const [scaleState, scaleAction, scalePending] = useActionState(
    setTypeScale.bind(null, designSystemId),
    initialState
  );

  return (
    <div className="flex flex-col gap-8">
      <form action={fontAction} className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Font family</h3>

        <div className="flex gap-1 rounded-md bg-muted p-1 w-fit">
          <button
            type="button"
            onClick={() => setSource("google")}
            className={`rounded-sm px-3 py-1 text-sm ${source === "google" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
          >
            Google Fonts
          </button>
          <button
            type="button"
            onClick={() => setSource("custom")}
            className={`rounded-sm px-3 py-1 text-sm ${source === "custom" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
          >
            Custom file URL
          </button>
        </div>
        <input type="hidden" name="source" value={source} />

        {source === "google" ? (
          <div className="grid gap-2 max-w-xs">
            <Label>Font</Label>
            <FontCombobox name="fontName" defaultValue={currentFontName} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
            <div className="grid gap-2">
              <Label htmlFor="customName">Font name</Label>
              <Input id="customName" name="customName" placeholder="My Custom Font" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customUrl">File URL (.woff2, .css, etc.)</Label>
              <Input id="customUrl" name="customUrl" placeholder="https://…/font.woff2" />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={fontPending} className="w-fit">
            {fontPending ? "Saving…" : "Set font"}
          </Button>
          {fontState && "error" in fontState ? (
            <span className="text-sm text-destructive">{fontState.error}</span>
          ) : null}
          {fontState && "success" in fontState ? (
            <span className="text-sm text-muted-foreground">Saved.</span>
          ) : null}
        </div>
      </form>

      <form action={scaleAction} className="flex flex-col gap-4 border-t pt-6">
        <h3 className="text-sm font-semibold text-muted-foreground">Type scale</h3>
        <p className="text-sm text-muted-foreground">
          Generates font-size.xs through font-size.3xl using a modular
          scale — base size × ratio^step.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 max-w-md">
          <div className="grid gap-2">
            <Label htmlFor="baseSize">Base size (px)</Label>
            <Input
              id="baseSize"
              name="baseSize"
              type="number"
              min={1}
              defaultValue={currentBaseSize ?? 16}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ratio">Scale ratio</Label>
            <Input id="ratio" name="ratio" type="number" step="0.01" min={1.01} defaultValue={1.25} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={scalePending} variant="secondary" className="w-fit">
            {scalePending ? "Generating…" : "Generate scale"}
          </Button>
          {scaleState && "error" in scaleState ? (
            <span className="text-sm text-destructive">{scaleState.error}</span>
          ) : null}
          {scaleState && "success" in scaleState ? (
            <span className="text-sm text-muted-foreground">Saved.</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
