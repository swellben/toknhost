"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Moon,
  Palette,
  RotateCcw,
  Settings,
  Sun,
  Type,
  Radius as RadiusIcon,
  Ruler,
  Layers,
  Check,
  Copy,
  Undo2,
  Wand2,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { materialColorScale } from "@/lib/gap-fill/material";
import {
  loadGoogleFont,
  googleFontStack,
  loadCustomFont,
  customFontStack,
  isStylesheetUrl,
} from "@/lib/studio/google-font-loader";
import { FontPicker } from "@/components/studio/font-picker";
import {
  DEFAULT_THEME,
  RADIUS_OPTIONS,
  RADIUS_RANGE,
  RADIUS_DERIVED,
  SEED_META,
  SPACING_OPTIONS,
  SPACING_RANGE,
  SPACING_SCALE_STEPS,
  STEPS,
  buildRamps,
  buildThemeCss,
  deriveTheme,
  type EditMode,
  type FontSource,
  type Ramp,
  type SeedKey,
  type ThemeConfig,
} from "@/lib/studio/theme";
import { ThemePreview } from "@/components/studio/theme-preview";

type NavKey = "color" | "typography" | "spacing" | "radius" | "semantic";

/** A state update; `coalesceKey` groups a run of continuous edits (e.g.
 * dragging a color picker) into a single undo step. Omit it for discrete
 * actions so each one is its own undo step. */
type Commit = (
  producer: (c: ThemeConfig) => ThemeConfig,
  coalesceKey?: string
) => void;

const PRIMITIVE_NAV: { key: NavKey; label: string; icon: typeof Palette }[] = [
  { key: "color", label: "Color", icon: Palette },
  { key: "typography", label: "Typography", icon: Type },
  { key: "spacing", label: "Spacing", icon: Ruler },
  { key: "radius", label: "Radius", icon: RadiusIcon },
];

/* ---------- Undo/reset history ---------- */

type History = { config: ThemeConfig; past: ThemeConfig[]; lastKey: string | null };

function useThemeHistory(initial: ThemeConfig) {
  const [hist, setHist] = useState<History>({
    config: initial,
    past: [],
    lastKey: null,
  });

  const commit = useCallback<Commit>((producer, coalesceKey) => {
    setHist((h) => {
      const next = producer(h.config);
      if (next === h.config) return h;
      // Push a history snapshot unless this edit continues the previous one
      // (same coalesceKey) — that keeps a color-picker drag to one undo step.
      const push = coalesceKey == null || coalesceKey !== h.lastKey;
      return {
        config: next,
        past: push ? [...h.past, h.config] : h.past,
        lastKey: coalesceKey ?? null,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHist((h) =>
      h.past.length === 0
        ? h
        : {
            config: h.past[h.past.length - 1],
            past: h.past.slice(0, -1),
            lastKey: null,
          }
    );
  }, []);

  const reset = useCallback(() => {
    setHist((h) =>
      h.config === DEFAULT_THEME
        ? h
        : { config: DEFAULT_THEME, past: [...h.past, h.config], lastKey: null }
    );
  }, []);

  return { config: hist.config, commit, undo, reset, canUndo: hist.past.length > 0 };
}

export function ThemeStudio() {
  const { config, commit, undo, reset, canUndo } = useThemeHistory(DEFAULT_THEME);
  const [nav, setNav] = useState<NavKey>("color");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [exportOpen, setExportOpen] = useState(false);

  const theme = useMemo(() => deriveTheme(config), [config]);

  // Ensure the chosen font is loaded whenever it changes (incl. undo),
  // regardless of which editor tab is open. Cached, so this is cheap.
  useEffect(() => {
    if (config.fontSource === "google" && config.fontName) {
      loadGoogleFont(config.fontName);
    } else if (config.fontSource === "custom" && config.customFont) {
      loadCustomFont(config.customFont);
    }
  }, [config.fontSource, config.fontName, config.customFont]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-md bg-primary" />
          <span className="text-sm font-semibold">Tokn.Host</span>
          <span className="ml-2 text-sm text-muted-foreground">
            Untitled theme
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={undo}
            disabled={!canUndo}
            title="Undo last change"
          >
            <Undo2 /> Undo
          </Button>
          <ModeToggle mode={mode} onChange={setMode} />
          <Button size="sm" onClick={() => setExportOpen(true)}>
            <Download /> Export
          </Button>
        </div>
      </header>

      {/* Three panes */}
      <div className="grid min-h-0 flex-1 grid-cols-[220px_320px_1fr]">
        {/* Left rail */}
        <nav className="flex min-h-0 flex-col justify-between border-r border-border p-3">
          <div className="flex flex-col gap-4">
            <NavGroup title="Primitives">
              {PRIMITIVE_NAV.map((item) => (
                <NavItem
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  active={nav === item.key}
                  onClick={() => setNav(item.key)}
                />
              ))}
            </NavGroup>
            <NavGroup title="Semantic tokens">
              <NavItem
                icon={Layers}
                label="Roles"
                active={nav === "semantic"}
                onClick={() => setNav("semantic")}
              />
            </NavGroup>
          </div>

          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <NavItem
              icon={Undo2}
              label="Undo"
              disabled={!canUndo}
              onClick={undo}
            />
            <NavItem
              icon={Download}
              label="Import / Export"
              onClick={() => setExportOpen(true)}
            />
            <NavItem icon={RotateCcw} label="Reset all" onClick={reset} />
            <NavItem icon={Settings} label="Settings" disabled />
          </div>
        </nav>

        {/* Middle editor */}
        <section className="min-h-0 overflow-y-auto border-r border-border p-4">
          {nav === "color" && <ColorEditor config={config} commit={commit} />}
          {nav === "typography" && (
            <TypographyEditor config={config} commit={commit} />
          )}
          {nav === "spacing" && (
            <SpacingEditor config={config} commit={commit} />
          )}
          {nav === "radius" && <RadiusEditor config={config} commit={commit} />}
          {nav === "semantic" && <SemanticList theme={theme} mode={mode} />}
        </section>

        {/* Right preview */}
        <section className="min-h-0 overflow-y-auto bg-muted/30 p-6">
          <ThemePreview theme={theme} config={config} mode={mode} />
        </section>
      </div>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        css={buildThemeCss(theme, config)}
      />
    </div>
  );
}

/* ---------- Left rail ---------- */

function NavGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </span>
      {children}
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof Palette;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

/* ---------- Generated / Manual toggle ---------- */

function EditModeToggle({
  mode,
  onChange,
}: {
  mode: EditMode;
  onChange: (m: EditMode) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
      {(["generated", "manual"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 transition-colors",
            mode === m
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {m === "generated" ? (
            <Wand2 className="size-3.5" />
          ) : (
            <SlidersHorizontal className="size-3.5" />
          )}
          {m === "generated" ? "Generated" : "Manual"}
        </button>
      ))}
    </div>
  );
}

/* ---------- Color editor ---------- */

function ColorEditor({
  config,
  commit,
}: {
  config: ThemeConfig;
  commit: Commit;
}) {
  const manual = config.colorMode === "manual";

  function setColorMode(m: EditMode) {
    commit((c) =>
      m === c.colorMode
        ? c
        : m === "generated"
          ? { ...c, colorMode: "generated", ramps: buildRamps(c.seeds) }
          : { ...c, colorMode: "manual" }
    );
  }

  function setSeed(key: SeedKey, value: string) {
    commit(
      (c) => ({
        ...c,
        seeds: { ...c.seeds, [key]: value },
        ramps: { ...c.ramps, [key]: materialColorScale(value) as Ramp },
      }),
      `seed:${key}`
    );
  }

  function setStep(key: SeedKey, step: number, value: string) {
    commit(
      (c) => ({
        ...c,
        ramps: { ...c.ramps, [key]: { ...c.ramps[key], [step]: value } },
      }),
      `ramp:${key}:${step}`
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Color</h2>
          <p className="text-xs text-muted-foreground">
            {manual
              ? "Edit any step of any scale directly."
              : "Pick a seed — the 50–950 scale is generated."}
          </p>
        </div>
        <EditModeToggle mode={config.colorMode} onChange={setColorMode} />
      </div>

      {manual && (
        <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
          Switching to Generated regenerates scales from seeds and discards
          manual edits. Use Undo to recover.
        </p>
      )}

      {SEED_META.map(({ key, label, hint }) =>
        manual ? (
          <ManualScale
            key={key}
            label={label}
            ramp={config.ramps[key]}
            onStep={(step, v) => setStep(key, step, v)}
          />
        ) : (
          <div key={key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="relative size-8 shrink-0 overflow-hidden rounded-md border border-border">
                <input
                  type="color"
                  value={config.seeds[key]}
                  onChange={(e) => setSeed(key, e.target.value)}
                  className="absolute inset-0 size-full cursor-pointer"
                  aria-label={`${label} seed color`}
                />
              </label>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{hint}</div>
              </div>
              <Input
                value={config.seeds[key]}
                onChange={(e) => setSeed(key, e.target.value)}
                className="h-7 w-24 font-mono text-xs"
              />
            </div>
            <Ramp ramp={config.ramps[key]} />
          </div>
        )
      )}
    </div>
  );
}

/** Read-only ramp strip (generated mode). */
function Ramp({ ramp }: { ramp: Record<number, string> }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border">
      {STEPS.map((step) => (
        <div
          key={step}
          className="group relative h-7 flex-1"
          style={{ background: ramp[step] }}
          title={`${step} · ${ramp[step]}`}
        >
          <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden justify-center text-[9px] group-hover:flex">
            <span className="rounded-sm bg-black/60 px-1 text-white">{step}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Editable ramp — every step is its own color input (manual mode). */
function ManualScale({
  label,
  ramp,
  onStep,
}: {
  label: string;
  ramp: Record<number, string>;
  onStep: (step: number, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-0.5">
        {STEPS.map((step) => (
          <label
            key={step}
            className="group relative flex-1 cursor-pointer"
            title={`${label} ${step} · ${ramp[step]}`}
          >
            <span
              className="block h-9 rounded-sm border border-border transition-transform group-hover:scale-105"
              style={{ background: ramp[step] }}
            />
            <input
              type="color"
              value={ramp[step]}
              onChange={(e) => onStep(step, e.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label={`${label} step ${step}`}
            />
            <span className="mt-0.5 block text-center text-[9px] text-muted-foreground">
              {step}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ---------- Typography editor ---------- */

function TypographyEditor({
  config,
  commit,
}: {
  config: ThemeConfig;
  commit: Commit;
}) {
  const isCustom = config.fontSource === "custom";

  function setSource(s: FontSource) {
    commit((c) =>
      s === c.fontSource
        ? c
        : {
            ...c,
            fontSource: s,
            fontSans:
              s === "google"
                ? c.fontName
                  ? googleFontStack(c.fontName)
                  : DEFAULT_THEME.fontSans
                : c.customFont
                  ? customFontStack(c.customFont.family)
                  : DEFAULT_THEME.fontSans,
          }
    );
  }

  function selectFont(name: string) {
    commit((c) => ({
      ...c,
      fontSource: "google",
      fontName: name,
      fontSans: googleFontStack(name),
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Typography</h2>
        <FontSourceToggle source={config.fontSource} onChange={setSource} />
      </div>

      {isCustom ? (
        <CustomFontEditor config={config} commit={commit} />
      ) : (
        <div className="flex flex-col gap-3">
          <FontPicker value={config.fontName} onSelect={selectFont} />
          <FontPreview
            label={config.fontName || "No font selected"}
            fontFamily={config.fontSans}
          />
          <p className="text-xs text-muted-foreground">
            Loaded on demand; the export includes an
            <code className="mx-1 rounded bg-muted px-1">@import</code>for it.
          </p>
        </div>
      )}
    </div>
  );
}

function FontSourceToggle({
  source,
  onChange,
}: {
  source: FontSource;
  onChange: (s: FontSource) => void;
}) {
  const opts: [FontSource, string][] = [
    ["google", "Google Fonts"],
    ["custom", "Custom"],
  ];
  return (
    <div className="flex shrink-0 items-center rounded-md border border-border p-0.5 text-xs">
      {opts.map(([val, label]) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={cn(
            "rounded px-2 py-1 whitespace-nowrap transition-colors",
            source === val
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FontPreview({
  label,
  fontFamily,
}: {
  label: string;
  fontFamily: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-1 truncate text-xs text-muted-foreground">{label}</p>
      <p className="text-lg" style={{ fontFamily }}>
        The quick brown fox jumps over the lazy dog
      </p>
      <p className="text-2xl font-semibold" style={{ fontFamily }}>
        1234567890
      </p>
    </div>
  );
}

/** Custom font: paste a URL (stylesheet or font file) or upload a font file. */
function CustomFontEditor({
  config,
  commit,
}: {
  config: ThemeConfig;
  commit: Commit;
}) {
  const cf = config.customFont;
  const method = cf?.method ?? "url";
  const family = cf?.family ?? "";
  const url = cf?.method === "url" ? cf.src : "";

  function setMethod(m: "url" | "upload") {
    if (m === method) return;
    commit((c) => ({
      ...c,
      fontSource: "custom",
      customFont: {
        method: m,
        family: c.customFont?.family ?? "",
        src: "",
        kind: "fontfile",
      },
      fontSans: c.customFont?.family
        ? customFontStack(c.customFont.family)
        : c.fontSans,
    }));
  }

  function setFamily(name: string) {
    commit(
      (c) => ({
        ...c,
        fontSource: "custom",
        customFont: {
          method: c.customFont?.method ?? "url",
          src: c.customFont?.src ?? "",
          kind: c.customFont?.kind ?? "fontfile",
          fileName: c.customFont?.fileName,
          family: name,
        },
        fontSans: name ? customFontStack(name) : c.fontSans,
      }),
      "cf-family"
    );
  }

  function setUrl(value: string) {
    commit(
      (c) => {
        const fam = c.customFont?.family || familyFromUrl(value);
        return {
          ...c,
          fontSource: "custom",
          customFont: {
            method: "url",
            family: fam,
            src: value,
            kind: isStylesheetUrl(value) ? "stylesheet" : "fontfile",
          },
          fontSans: fam ? customFontStack(fam) : c.fontSans,
        };
      },
      "cf-url"
    );
  }

  function onUpload(file: File) {
    const src = URL.createObjectURL(file);
    const fam =
      config.customFont?.family || file.name.replace(/\.[^.]+$/, "");
    commit((c) => ({
      ...c,
      fontSource: "custom",
      customFont: {
        method: "upload",
        family: fam,
        src,
        kind: "fontfile",
        fileName: file.name,
      },
      fontSans: customFontStack(fam),
    }));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* URL / Upload sub-toggle */}
      <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
        {(["url", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={cn(
              "flex-1 rounded px-2 py-1 transition-colors",
              method === m
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "url" ? "Paste URL" : "Upload file"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Font family name
        </label>
        <Input
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          placeholder="e.g. Satoshi"
          className="h-8 text-sm"
        />
      </div>

      {method === "url" ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Font URL
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/font.woff2  or a stylesheet .css"
            className="h-8 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            A <code className="rounded bg-muted px-1">.woff2/.ttf</code> file
            URL becomes an <code className="rounded bg-muted px-1">@font-face</code>;
            a <code className="rounded bg-muted px-1">.css</code> URL is imported.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Font file
          </label>
          <input
            type="file"
            accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
            className="text-xs file:mr-2 file:rounded-md file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs"
          />
          {cf?.method === "upload" && cf.fileName && (
            <p className="text-xs text-muted-foreground">
              Loaded <span className="font-medium">{cf.fileName}</span> — preview
              only; self-host to ship it (see export).
            </p>
          )}
        </div>
      )}

      <FontPreview
        label={family || "No font set"}
        fontFamily={config.fontSans}
      />
    </div>
  );
}

/** Best-effort family name from a font-file URL (fallback when none given). */
function familyFromUrl(url: string): string {
  const file = url.split("/").pop()?.split("?")[0] ?? "";
  const base = file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base ? base.replace(/\b\w/g, (m) => m.toUpperCase()) : "";
}

/* ---------- Spacing editor ---------- */

function SpacingEditor({
  config,
  commit,
}: {
  config: ThemeConfig;
  commit: Commit;
}) {
  const manual = config.spacingMode === "manual";

  function setMode(m: EditMode) {
    commit((c) => (m === c.spacingMode ? c : { ...c, spacingMode: m }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Spacing</h2>
          <p className="text-xs text-muted-foreground">
            Global density — scales every padding, gap &amp; size at once.
          </p>
        </div>
        <EditModeToggle mode={config.spacingMode} onChange={setMode} />
      </div>

      {manual ? (
        <ManualSpacing config={config} commit={commit} />
      ) : (
        <div className="flex flex-col gap-2">
          {SPACING_OPTIONS.map((s) => {
            const active = config.spacing === s.value;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() =>
                  commit((c) => ({
                    ...c,
                    spacing: s.value,
                    spacingMode: "generated",
                  }))
                }
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-primary bg-muted"
                    : "border-border hover:bg-muted/60"
                )}
              >
                <span
                  className="flex w-8 shrink-0 flex-col"
                  style={{ gap: `${s.value * 0.9}rem` }}
                >
                  <span className="h-1 rounded-full bg-primary/70" />
                  <span className="h-1 rounded-full bg-primary/70" />
                  <span className="h-1 rounded-full bg-primary/70" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.hint}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {s.value}rem
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Manual spacing: fine-tune the one base unit; Tailwind derives the whole
 * scale from it, shown read-only so users see the resulting tokens. */
function ManualSpacing({
  config,
  commit,
}: {
  config: ThemeConfig;
  commit: Commit;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Base unit</span>
          <span className="font-mono text-xs text-muted-foreground">
            {config.spacing.toFixed(2)}rem
          </span>
        </div>
        <input
          type="range"
          min={SPACING_RANGE.min}
          max={SPACING_RANGE.max}
          step={SPACING_RANGE.step}
          value={config.spacing}
          onChange={(e) =>
            commit(
              (c) => ({
                ...c,
                spacing: Number(e.target.value),
                spacingMode: "manual",
              }),
              "spacing"
            )
          }
          className="w-full accent-primary"
          aria-label="Base spacing unit"
        />
        <p className="text-xs text-muted-foreground">
          In Tailwind every spacing token is a multiple of this one unit.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          Derived scale
        </span>
        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          {SPACING_SCALE_STEPS.map((n) => (
            <div key={n} className="flex items-center gap-3 px-2.5 py-1.5">
              <span className="w-8 font-mono text-xs text-muted-foreground">
                {n}
              </span>
              <span
                className="h-3 rounded-sm bg-primary/40"
                style={{ width: `${n * config.spacing}rem` }}
              />
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {(n * config.spacing).toFixed(2)}rem
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Radius editor ---------- */

function RadiusEditor({
  config,
  commit,
}: {
  config: ThemeConfig;
  commit: Commit;
}) {
  const manual = config.radiusMode === "manual";

  function setMode(m: EditMode) {
    commit((c) => (m === c.radiusMode ? c : { ...c, radiusMode: m }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Radius</h2>
          <p className="text-xs text-muted-foreground">
            Base corner radius — sm/md/lg/xl derive from it.
          </p>
        </div>
        <EditModeToggle mode={config.radiusMode} onChange={setMode} />
      </div>

      {manual ? (
        <ManualRadius config={config} commit={commit} />
      ) : (
        <div className="flex flex-col gap-2">
          {RADIUS_OPTIONS.map((r) => {
            const active = config.radius === r.value;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() =>
                  commit((c) => ({
                    ...c,
                    radius: r.value,
                    radiusMode: "generated",
                  }))
                }
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-primary bg-muted"
                    : "border-border hover:bg-muted/60"
                )}
              >
                <span className="flex w-8 shrink-0 justify-center">
                  <span
                    className="size-7 border-2 border-primary bg-primary/15"
                    style={{ borderRadius: `${r.value}rem` }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.hint}
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {r.value}rem
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Manual radius: fine-tune the base value; shadcn derives sm/md/lg/xl,
 * shown read-only so users see the resulting corners. */
function ManualRadius({
  config,
  commit,
}: {
  config: ThemeConfig;
  commit: Commit;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Base radius</span>
          <span className="font-mono text-xs text-muted-foreground">
            {config.radius.toFixed(2)}rem
          </span>
        </div>
        <input
          type="range"
          min={RADIUS_RANGE.min}
          max={RADIUS_RANGE.max}
          step={RADIUS_RANGE.step}
          value={config.radius}
          onChange={(e) =>
            commit(
              (c) => ({
                ...c,
                radius: Number(e.target.value),
                radiusMode: "manual",
              }),
              "radius"
            )
          }
          className="w-full accent-primary"
          aria-label="Base corner radius"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          Derived radii
        </span>
        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          {RADIUS_DERIVED.map(({ name, offsetPx }) => {
            const css = `calc(${config.radius}rem + ${offsetPx}px)`;
            return (
              <div key={name} className="flex items-center gap-3 px-2.5 py-1.5">
                <span className="w-8 font-mono text-xs text-muted-foreground">
                  {name}
                </span>
                <span
                  className="size-6 border-2 border-primary bg-primary/15"
                  style={{ borderRadius: css }}
                />
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {name === "lg"
                    ? `${config.radius}rem`
                    : `${config.radius}rem ${offsetPx > 0 ? "+" : "−"} ${Math.abs(offsetPx)}px`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Semantic roles list ---------- */

function SemanticList({
  theme,
  mode,
}: {
  theme: ReturnType<typeof deriveTheme>;
  mode: "light" | "dark";
}) {
  const vars = mode === "light" ? theme.light : theme.dark;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">Semantic roles</h2>
        <p className="text-xs text-muted-foreground">
          shadcn roles, resolved for {mode} mode. Each aliases a primitive.
        </p>
      </div>
      <div className="flex flex-col divide-y divide-border rounded-md border border-border">
        {Object.entries(vars).map(([name, value]) => (
          <div key={name} className="flex items-center gap-2 px-2.5 py-1.5">
            <span
              className="size-4 shrink-0 rounded-sm border border-border"
              style={{ background: value }}
            />
            <span className="flex-1 truncate text-sm">{name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Light/dark toggle ---------- */

function ModeToggle({
  mode,
  onChange,
}: {
  mode: "light" | "dark";
  onChange: (m: "light" | "dark") => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border p-0.5">
      {(["light", "dark"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
            mode === m
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {m === "light" ? (
            <Sun className="size-3.5" />
          ) : (
            <Moon className="size-3.5" />
          )}
          {m === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}

/* ---------- Export dialog ---------- */

function ExportDialog({
  open,
  onOpenChange,
  css,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  css: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export theme.css</DialogTitle>
          <DialogDescription>
            Drop this into your app&apos;s CSS. Works with Tailwind v4 + shadcn.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            className="absolute top-2 right-2 z-10"
            onClick={copy}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <pre className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
            {css}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
