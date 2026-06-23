"use client";

import { useActionState } from "react";
import { createDesignSystem, type ActionResult } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionResult = undefined;

export function CreateDesignSystemForm() {
  const [state, formAction, pending] = useActionState(
    createDesignSystem,
    initialState
  );

  return (
    <form action={formAction} className="flex items-end gap-2">
      <Input
        name="name"
        placeholder="e.g. Acme Web"
        required
        className="max-w-xs"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "New design system"}
      </Button>
      {state?.error && (
        <span className="text-sm text-destructive">{state.error}</span>
      )}
    </form>
  );
}
