"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Real shadcn-component rendering of a design system, not a generic mockup
 * re-themed — uses this app's own actual installed shadcn/ui components
 * (src/components/ui/), the same ones a real shadcn consumer would render.
 * The design system's `framework=shadcn` MCP output already uses the exact
 * CSS variable names (`primary`, `primary-foreground`, etc.) these
 * components' Tailwind classes resolve through (`bg-primary` ->
 * `var(--color-primary)` -> `var(--primary)`, per globals.css's
 * `@theme inline` block) — so overriding those variables on a wrapper div
 * makes every real component inside it render with the design system's
 * actual values, no build step, no separate compile.
 */
export function ShadcnFrameworkPreview({
  variables,
}: {
  variables: Record<string, string> | null;
}) {
  if (!variables || Object.keys(variables).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Import tokens and run gap-fill (Details tab) to see a live preview.
      </p>
    );
  }

  // Prefix every shadcn-shaped variable name with "--" to override the
  // app's own theme variables locally, scoped to this wrapper only.
  const overrideStyle: CSSProperties = Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [`--${key}`, value])
  ) as CSSProperties;

  return (
    <div
      style={overrideStyle}
      className="flex flex-col gap-4 rounded-lg border bg-background p-4 text-foreground"
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="default">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account settings</CardTitle>
          <CardDescription>Real shadcn Card, Input, and Label components.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="shadcn-preview-email">Email</Label>
            <Input id="shadcn-preview-email" placeholder="you@example.com" readOnly />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="shadcn-preview-name">Name</Label>
            <Input id="shadcn-preview-name" placeholder="Jane Doe" readOnly />
          </div>
          <Button size="sm" className="w-fit">
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
