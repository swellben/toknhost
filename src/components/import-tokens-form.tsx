"use client";

import { useActionState } from "react";
import { importTokens, type ImportResult } from "@/app/dashboard/[id]/actions";
import { Button } from "@/components/ui/button";

const initialState: ImportResult = undefined;

export function ImportTokensForm({ designSystemId }: { designSystemId: string }) {
  const [state, formAction, pending] = useActionState(
    importTokens.bind(null, designSystemId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="raw"
        rows={10}
        placeholder='Paste tokens in any supported format — DTCG, Tokens Studio, Tailwind v3/v4, Shadcn, Bootstrap, Mantine, or Figma Variables JSON. e.g. { "color": { "primary": { "$value": "#3b82f6", "$type": "color" } } }'
        className="w-full rounded-md border bg-transparent p-3 font-mono text-sm"
        required
      />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
        {state && "error" in state ? (
          <span className="text-sm text-destructive">{state.error}</span>
        ) : null}
        {state && "success" in state ? (
          <span className="text-sm text-muted-foreground">
            Imported {state.count} tokens.
            {state.warnings.length > 0
              ? ` (${state.warnings.length} warnings — see console)`
              : ""}
          </span>
        ) : null}
      </div>
    </form>
  );
}
