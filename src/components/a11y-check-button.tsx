"use client";

import { useActionState } from "react";
import { runAccessibilityChecks, type A11yResult } from "@/app/dashboard/[id]/a11y-actions";
import { Button } from "@/components/ui/button";

const initialState: A11yResult = undefined;

export function A11yCheckButton({ designSystemId }: { designSystemId: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: A11yResult) => runAccessibilityChecks(designSystemId),
    initialState
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Checking…" : "Run accessibility checks"}
      </Button>
      {state && "error" in state ? (
        <span className="text-sm text-destructive">{state.error}</span>
      ) : null}
      {state && "success" in state ? (
        <span className="text-sm text-muted-foreground">
          Checked {state.checkedCount} pairs across all modes — {state.failingCount} fail AA.
        </span>
      ) : null}
    </form>
  );
}
