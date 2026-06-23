"use client";

import { useActionState } from "react";
import {
  updateDesignSystem,
  type UpdateDesignSystemResult,
} from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: UpdateDesignSystemResult = undefined;

const TARGET_FRAMEWORKS = [
  { value: "tailwind-v4", label: "Tailwind v4 (generic)" },
  { value: "shadcn", label: "Tailwind v4 + shadcn/ui" },
  { value: "tailwind-v3", label: "Tailwind v3 (tailwind.config.js)" },
  { value: "css-variables", label: "Plain CSS variables" },
  { value: "dtcg", label: "DTCG (W3C Design Tokens)" },
];

export function EditDesignSystemForm({
  designSystemId,
  name,
  description,
  isPublic,
  targetFramework,
}: {
  designSystemId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  targetFramework: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateDesignSystem.bind(null, designSystemId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-md">
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={description ?? ""}
          placeholder="Optional"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="targetFramework">Target framework</Label>
        <select
          id="targetFramework"
          name="targetFramework"
          defaultValue={targetFramework}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          {TARGET_FRAMEWORKS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Shapes how tokens are presented to consuming AI agents/tools —
          variable names and value formats match this framework's
          conventions.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublic" defaultChecked={isPublic} />
        Public — readable without auth
      </label>
      {state && "error" in state ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state && "success" in state ? (
        <p className="text-sm text-success">Saved.</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
