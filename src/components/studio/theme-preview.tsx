"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewVars, type DerivedTheme, type ThemeConfig } from "@/lib/studio/theme";

/**
 * Live sample product UI. Real shadcn components re-themed by overriding the
 * CSS variables on this wrapper (the mechanism proven in
 * shadcn-framework-preview.tsx). Switching `mode` swaps the variable set;
 * `fontFamily` is set directly because globals.css inlines `--font-sans`.
 */
export function ThemePreview({
  theme,
  config,
  mode,
}: {
  theme: DerivedTheme;
  config: ThemeConfig;
  mode: "light" | "dark";
}) {
  const vars = mode === "light" ? theme.light : theme.dark;
  // Set fontFamily (for inherited text) AND override the underlying font
  // variables: shadcn components use `font-sans`/`font-heading` utilities that
  // compile to an explicit `var(--font-dm-sans)` / `var(--font-sans)`, so plain
  // inheritance alone leaves card titles etc. on the app's default font.
  // (Leave --font-dm-mono untouched so mono text stays mono.)
  const style = {
    ...previewVars(vars, config.radius, config.spacing),
    fontFamily: config.fontSans,
    "--font-dm-sans": config.fontSans,
    "--font-sans": config.fontSans,
    "--font-heading": config.fontSans,
  } as CSSProperties;

  const stats = [
    { label: "Revenue", value: "$48,120", delta: "+12.4%", chart: "chart-1" },
    { label: "Active users", value: "2,318", delta: "+3.1%", chart: "chart-2" },
    { label: "Churn", value: "1.8%", delta: "-0.4%", chart: "chart-3" },
  ];

  return (
    <div
      style={style}
      className="flex min-h-full flex-col gap-6 rounded-xl border border-border bg-background p-6 text-foreground"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-primary" />
          <span className="text-sm font-semibold">Acme Analytics</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            Docs
          </Button>
          <Button size="sm">New report</Button>
        </div>
      </div>

      <div className="grid grid-cols-[180px_1fr] gap-6">
        {/* Sidebar */}
        <aside
          className="flex flex-col gap-1 rounded-lg p-3 text-sm"
          style={{
            background: "var(--sidebar)",
            color: "var(--sidebar-foreground)",
          }}
        >
          {["Overview", "Reports", "Customers", "Settings"].map((item, i) => (
            <div
              key={item}
              className="rounded-md px-3 py-1.5"
              style={
                i === 0
                  ? {
                      background: "var(--sidebar-primary)",
                      color: "var(--sidebar-primary-foreground)",
                    }
                  : undefined
              }
            >
              {item}
            </div>
          ))}
        </aside>

        {/* Main */}
        <div className="flex flex-col gap-6">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardHeader>
                  <CardDescription>{s.label}</CardDescription>
                  <CardTitle className="text-2xl">{s.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: `var(--${s.chart})` }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {s.delta} vs last month
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Buttons + form + statuses */}
          <div className="grid grid-cols-[1fr_1fr] gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Controls</CardTitle>
                <CardDescription>Every button variant.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Delete</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill label="Success" varName="chart-3" />
                  <StatusPill label="Warning" varName="chart-4" />
                  <StatusPill label="Danger" varName="chart-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Create account</CardTitle>
                <CardDescription>Real Input & Label.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="preview-email">Email</Label>
                  <Input id="preview-email" placeholder="you@acme.com" readOnly />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="preview-name">Full name</Label>
                  <Input id="preview-name" placeholder="Jane Doe" readOnly />
                </div>
                <Button size="sm" className="w-fit">
                  Save changes
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, varName }: { label: string; varName: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{
        borderColor: `color-mix(in oklch, var(--${varName}), transparent 60%)`,
        background: `color-mix(in oklch, var(--${varName}), transparent 88%)`,
        color: `var(--${varName})`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: `var(--${varName})` }}
      />
      {label}
    </span>
  );
}
