"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { runGapFill, type GapFillResult } from "@/app/dashboard/[id]/actions";
import { Button } from "@/components/ui/button";

const initialState: GapFillResult = undefined;

export function GapFillButton({ designSystemId }: { designSystemId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_prev: GapFillResult) => runGapFill(designSystemId),
    initialState
  );

  // Force the server component tree to re-render so the preview pane picks
  // up newly generated tokens.
  useEffect(() => {
    if (state && "success" in state) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Gap-filling…" : "Run gap-fill"}
      </Button>
      {state && "error" in state ? (
        <span className="text-sm text-destructive">{state.error}</span>
      ) : null}
      {state && "success" in state ? (
        <span className="text-sm text-muted-foreground">Done.</span>
      ) : null}
    </form>
  );
}
