"use client";

import { useActionState } from "react";
import { freeformImport, type FreeformImportResult } from "@/app/dashboard/[id]/actions";
import { Button } from "@/components/ui/button";

const initialState: FreeformImportResult = undefined;
const CHAR_CAP = 4000;

export function FreeformImportForm({ designSystemId }: { designSystemId: string }) {
  const [state, formAction, pending] = useActionState(
    freeformImport.bind(null, designSystemId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="text"
        rows={6}
        maxLength={CHAR_CAP}
        placeholder="Describe your brand in plain language — e.g. primary color is a deep forest green, secondary is a warm coral, use Inter, and fairly rounded corners around 12px."
        className="w-full rounded-md border bg-transparent p-3 text-sm"
        required
      />
      <p className="text-xs text-muted-foreground">
        One AI call extracts primary/secondary color, font, and border radius — the
        same fields Quick Start collects. Anything else you mention gets noted but not
        used. Up to {CHAR_CAP.toLocaleString()} characters.
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Reading…" : "Generate from description"}
        </Button>
        {state && "error" in state ? (
          <span className="text-sm text-destructive">{state.error}</span>
        ) : null}
        {state && "success" in state ? (
          <span className="text-sm text-muted-foreground">
            Created {state.createdCount} tokens.
            {state.ambiguous.length > 0
              ? ` Noted but not used: ${state.ambiguous.join("; ")}.`
              : ""}
          </span>
        ) : null}
      </div>
    </form>
  );
}
