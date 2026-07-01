"use client";

import { useActionState } from "react";
import { smartImport, type SmartImportResult } from "@/app/dashboard/[id]/actions";
import { Button } from "@/components/ui/button";

const initialState: SmartImportResult = undefined;
const CHAR_CAP = 4000;

/**
 * One textarea, any input shape — a well-formed token file (DTCG, Tokens
 * Studio, Tailwind v3/v4, Shadcn, Bootstrap, Mantine, Figma Variables),
 * freeform prose describing a brand, or a partial/malformed token blob.
 * `smartImport` tries deterministic parsing first and only falls back to AI
 * extraction if that doesn't confidently match a known format.
 */
export function SmartImportForm({ designSystemId }: { designSystemId: string }) {
  const [state, formAction, pending] = useActionState(
    smartImport.bind(null, designSystemId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="text"
        rows={10}
        maxLength={CHAR_CAP}
        placeholder={
          "Paste or describe your design system — a token file in any supported format " +
          "(DTCG, Tokens Studio, Tailwind, Shadcn, Bootstrap, Mantine, Figma Variables), " +
          "a partial/rough token list, or just plain language: \"primary is a deep forest " +
          "green, secondary a warm coral, use Inter, fairly rounded corners around 12px.\""
        }
        className="w-full rounded-md border bg-transparent p-3 font-mono text-sm"
        required
      />
      <p className="text-xs text-muted-foreground">
        Recognized token formats are parsed directly; anything else falls back to one AI
        call that extracts primary/secondary color, font, and border radius (up to{" "}
        {CHAR_CAP.toLocaleString()} characters for the AI fallback). Missing pieces are
        filled in automatically.
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
        {state && "error" in state ? (
          <span className="text-sm text-destructive">{state.error}</span>
        ) : null}
        {state && "success" in state ? (
          <span className="text-sm text-muted-foreground">
            {state.mode === "parsed"
              ? `Imported directly.`
              : `Generated from description.`}
            {state.warnings && state.warnings.length > 0
              ? ` (${state.warnings.length} warnings — see console)`
              : ""}
            {state.ambiguous && state.ambiguous.length > 0
              ? ` Noted but not used: ${state.ambiguous.join("; ")}.`
              : ""}
          </span>
        ) : null}
      </div>
    </form>
  );
}
