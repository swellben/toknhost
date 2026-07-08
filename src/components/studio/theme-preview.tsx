"use client";

import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { previewVars, type DerivedTheme, type ThemeConfig } from "@/lib/studio/theme";

/**
 * Live sample product UI. Real shadcn components (Button/Card/Input/Label/
 * Textarea) plus token-styled elements for components not installed here
 * (table, checkbox, radio, switch, badge, select, chart, pagination). Every
 * element resolves the overridden CSS variables on this wrapper, so the whole
 * thing re-themes instantly. `fontFamily` + font vars are set because
 * globals.css inlines the font utilities (see theme-studio font fix).
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

          {/* Chart + badges */}
          <div className="grid grid-cols-[1.4fr_1fr] gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Weekly revenue</CardTitle>
                <CardDescription>Bars use chart-1…5.</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
                <CardDescription>Status &amp; labels.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="muted">Muted</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill label="Success" varName="chart-3" />
                  <StatusPill label="Warning" varName="chart-4" />
                  <StatusPill label="Danger" varName="chart-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data table */}
          <Card>
            <CardHeader>
              <CardTitle>Customers</CardTitle>
              <CardDescription>A themed data table.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable />
              <Pagination />
            </CardContent>
          </Card>

          {/* Controls + form */}
          <div className="grid grid-cols-[1fr_1fr] gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Controls</CardTitle>
                <CardDescription>Buttons &amp; toggles.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Delete</Button>
                </div>
                <div className="flex flex-col gap-2">
                  <Checkbox checked label="Email notifications" />
                  <Checkbox label="SMS notifications" />
                </div>
                <div className="flex flex-col gap-2">
                  <Radio checked name="plan" label="Monthly billing" />
                  <Radio name="plan" label="Annual billing" />
                </div>
                <div className="flex items-center gap-6">
                  <Switch on label="Auto-renew" />
                  <Switch label="Beta features" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Create account</CardTitle>
                <CardDescription>Inputs, select &amp; textarea.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="preview-email">Email</Label>
                  <Input id="preview-email" placeholder="you@acme.com" readOnly />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="preview-plan">Plan</Label>
                  <Select value="Pro — $29/mo" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="preview-bio">Notes</Label>
                  <Textarea
                    id="preview-bio"
                    placeholder="Tell us about your team…"
                    readOnly
                    rows={3}
                  />
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

/* ---------- Token-styled elements (components not installed here) ---------- */

function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "secondary" | "muted" | "outline";
}) {
  const styles = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    muted: "bg-muted text-muted-foreground",
    outline: "border border-border text-foreground",
  }[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles
      )}
    >
      {children}
    </span>
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

function Checkbox({ checked, label }: { checked?: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-sm border transition-colors",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

function Radio({
  checked,
  label,
}: {
  checked?: boolean;
  name: string;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full border transition-colors",
          checked ? "border-primary" : "border-border"
        )}
      >
        {checked && <span className="size-2 rounded-full bg-primary" />}
      </span>
      {label}
    </label>
  );
}

function Switch({ on, label }: { on?: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
            on ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
      {label}
    </label>
  );
}

function Select({ value }: { value: string }) {
  return (
    <div className="relative">
      <div className="flex h-8 items-center justify-between rounded-md border border-input bg-background px-3 text-sm">
        <span>{value}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </div>
      {/* Open menu (static) to show popover + item theming */}
      <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md">
        {["Starter — free", "Pro — $29/mo", "Enterprise"].map((opt, i) => (
          <div
            key={opt}
            className={cn(
              "flex items-center justify-between rounded-sm px-2 py-1",
              i === 1 && "bg-accent text-accent-foreground"
            )}
          >
            {opt}
            {i === 1 && <Check className="size-3.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function DataTable() {
  const rows = [
    { name: "Jane Cooper", plan: "Pro", status: "Active", chart: "chart-3" },
    { name: "Cody Fisher", plan: "Starter", status: "Trial", chart: "chart-4" },
    { name: "Esther Howard", plan: "Enterprise", status: "Past due", chart: "chart-5" },
  ];
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            <Th>Name</Th>
            <Th>Plan</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-border">
              <Td className="font-medium">{r.name}</Td>
              <Td>{r.plan}</Td>
              <Td>
                <StatusPill label={r.status} varName={r.chart} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-medium">{children}</th>
  );
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2", className)}>{children}</td>;
}

function Pagination() {
  return (
    <div className="mt-3 flex items-center justify-between">
      <span className="text-xs text-muted-foreground">3 of 128 customers</span>
      <div className="flex items-center gap-1">
        <PageBtn>‹</PageBtn>
        <PageBtn active>1</PageBtn>
        <PageBtn>2</PageBtn>
        <PageBtn>3</PageBtn>
        <PageBtn>›</PageBtn>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  active,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-7 items-center justify-center rounded-md border text-xs",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-foreground"
      )}
    >
      {children}
    </span>
  );
}

function BarChart() {
  const bars = [
    { h: 42, c: "chart-1" },
    { h: 68, c: "chart-2" },
    { h: 55, c: "chart-3" },
    { h: 80, c: "chart-4" },
    { h: 34, c: "chart-5" },
    { h: 60, c: "chart-1" },
    { h: 72, c: "chart-2" },
  ];
  return (
    <div className="flex h-32 items-end gap-2 border-b border-border pb-px">
      {bars.map((b, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ height: `${b.h}%`, background: `var(--${b.c})` }}
        />
      ))}
    </div>
  );
}
