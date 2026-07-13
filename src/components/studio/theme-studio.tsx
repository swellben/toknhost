"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  Plus,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { McpPanel } from "@/components/studio/mcp-panel";
import type { Entitlements } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import type { StudioDesignSystem } from "@/lib/studio/persist";
import {
  listStudioDesignSystems,
  getStudioConfig,
  createStudioDesignSystem,
  saveStudioConfig,
} from "@/app/studio/actions";
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
  parseThemeTokens,
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

/** Stable key for a (name, config) pair — used to detect real changes for
 * autosave and to tell a pristine draft from an edited one. */
function snapshotKey(name: string, config: ThemeConfig): string {
  return JSON.stringify([name, config]);
}

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

  // Replace the whole editor state (e.g. loading a saved design system or
  // starting a new one) — clears the undo history since it's a fresh document.
  const load = useCallback((cfg: ThemeConfig) => {
    setHist({ config: cfg, past: [], lastKey: null });
  }, []);

  return {
    config: hist.config,
    commit,
    undo,
    reset,
    load,
    canUndo: hist.past.length > 0,
  };
}

export function ThemeStudio({
  userEmail,
  entitlements,
}: {
  userEmail?: string;
  entitlements: Entitlements;
}) {
  const { config, commit, undo, load, canUndo } = useThemeHistory(DEFAULT_THEME);
  const [nav, setNav] = useState<NavKey>("color");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [view, setView] = useState<"studio" | "io" | "mcp">("studio");
  const [resetOpen, setResetOpen] = useState(false);

  // Persistence: the loaded design system, its name, the switcher list, the
  // "new" dialog, and autosave status. There is no manual Save — edits and
  // renames autosave into the loaded theme; a new theme is created (named) via
  // the New dialog.
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled theme");
  const [systems, setSystems] = useState<StudioDesignSystem[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  // A signed-in free user at the plan's design-system cap gets an upgrade nudge
  // instead of the create dialog. Anonymous visitors aren't "at a limit" — they
  // just need to sign in — so the create dialog still opens for them (Save then
  // surfaces the sign-in requirement; the draft/claim flow lands in Phase 2).
  // `createStudioDesignSystem` is the authoritative gate; this is the affordance.
  const atSystemLimit =
    entitlements.authenticated &&
    systems.length >= entitlements.maxDesignSystems;
  const [save, setSave] = useState<
    { state: "idle" | "saving" | "saved" } | { state: "error"; message: string }
  >({ state: "idle" });
  // Key of the last-persisted (name, config) so autosave only fires on real changes.
  const lastSaved = useRef(snapshotKey("Untitled theme", DEFAULT_THEME));
  const didInit = useRef(false);

  const refreshSystems = useCallback(async () => {
    try {
      setSystems(await listStudioDesignSystems());
    } catch {
      /* not signed in / offline — leave the list empty */
    }
  }, []);

  // On mount, open the most-recently-edited theme so edits autosave into it.
  useEffect(() => {
    (async () => {
      let list: StudioDesignSystem[] = [];
      try {
        list = await listStudioDesignSystems();
      } catch {
        /* anonymous / offline */
      }
      setSystems(list);
      if (didInit.current) return;
      didInit.current = true;
      if (list.length === 0) return;
      const res = await getStudioConfig(list[0].id);
      if ("error" in res) return;
      load(res.config);
      setCurrentId(list[0].id);
      setName(res.name);
      lastSaved.current = snapshotKey(res.name, res.config);
    })();
  }, [load]);

  // Debounced autosave for the loaded theme — renames + edits persist with no
  // Save button.
  useEffect(() => {
    if (!currentId) return;
    if (snapshotKey(name, config) === lastSaved.current) return;
    const t = setTimeout(async () => {
      setSave({ state: "saving" });
      const res = await saveStudioConfig(currentId, name, config);
      if ("error" in res) {
        setSave({ state: "error", message: res.error });
        return;
      }
      lastSaved.current = snapshotKey(name, config);
      setSave({ state: "saved" });
      refreshSystems();
      setTimeout(
        () => setSave((s) => (s.state === "saved" ? { state: "idle" } : s)),
        1200
      );
    }, 800);
    return () => clearTimeout(t);
  }, [config, name, currentId, refreshSystems]);

  async function selectSystem(id: string) {
    const res = await getStudioConfig(id);
    if ("error" in res) {
      setSave({ state: "error", message: res.error });
      return;
    }
    load(res.config);
    setCurrentId(id);
    setName(res.name);
    lastSaved.current = snapshotKey(res.name, res.config);
    setView("studio");
    setSave({ state: "idle" });
  }

  // Create a brand-new named design system with fresh default colors, and
  // select it — subsequent edits autosave into it.
  async function createNamed(themeName: string) {
    const res = await createStudioDesignSystem(themeName, DEFAULT_THEME);
    setNewOpen(false);
    if ("error" in res) {
      setSave({ state: "error", message: res.error });
      return;
    }
    load(DEFAULT_THEME);
    setCurrentId(res.id);
    setName(themeName);
    lastSaved.current = snapshotKey(themeName, DEFAULT_THEME);
    setView("studio");
    setSave({ state: "idle" });
    refreshSystems();
  }

  // Reset to defaults (undoable). `keepBrand` preserves the primary & secondary
  // brand colors (seeds + ramps) and resets everything else.
  function doReset(keepBrand: boolean) {
    commit((c) =>
      keepBrand
        ? {
            ...DEFAULT_THEME,
            colorMode: c.colorMode,
            seeds: {
              ...DEFAULT_THEME.seeds,
              primary: c.seeds.primary,
              secondary: c.seeds.secondary,
            },
            ramps: {
              ...DEFAULT_THEME.ramps,
              primary: c.ramps.primary,
              secondary: c.ramps.secondary,
            },
          }
        : DEFAULT_THEME
    );
    setResetOpen(false);
  }

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

  // Selecting a token category also returns to the editor (from Import/Export).
  function goToEditor(key: NavKey) {
    setNav(key);
    setView("studio");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Logo className="size-5 shrink-0" />
          <span className="text-sm font-semibold">Tokn.Host</span>
          <div className="mx-1 h-4 w-px bg-border" />
          <SystemSwitcher
            name={name}
            onName={setName}
            systems={systems}
            currentId={currentId}
            onSelect={selectSystem}
            onNew={() => (atSystemLimit ? setLimitOpen(true) : setNewOpen(true))}
          />
        </div>
        <div className="flex items-center gap-3">
          {save.state === "error" ? (
            <span className="max-w-56 truncate text-xs text-destructive">
              {save.message}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {save.state === "saving"
                ? "Saving…"
                : save.state === "saved"
                  ? "Saved"
                  : ""}
            </span>
          )}
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
          {userEmail && (
            <>
              <div className="mx-1 h-4 w-px bg-border" />
              <UserMenu email={userEmail} />
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left rail — persistent across the editor AND import/export views */}
        <nav className="flex w-[220px] shrink-0 flex-col justify-between border-r border-border p-3">
          <div className="flex flex-col gap-4">
            <NavGroup title="Primitives">
              {PRIMITIVE_NAV.map((item) => (
                <NavItem
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  active={view === "studio" && nav === item.key}
                  onClick={() => goToEditor(item.key)}
                />
              ))}
            </NavGroup>
            <NavGroup title="Semantic tokens">
              <NavItem
                icon={Layers}
                label="Tokens"
                active={view === "studio" && nav === "semantic"}
                onClick={() => goToEditor("semantic")}
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
              active={view === "io"}
              onClick={() => setView("io")}
            />
            <NavItem
              icon={Server}
              label="MCP endpoint"
              active={view === "mcp"}
              onClick={() => setView("mcp")}
            />
            <NavItem
              icon={RotateCcw}
              label="Reset all"
              onClick={() => setResetOpen(true)}
            />
            <NavItem icon={Settings} label="Settings" disabled />
          </div>
        </nav>

        {/* Content area — swaps between the token editor+preview, import/export, and MCP handoff */}
        {view === "mcp" ? (
          <McpPanel designSystemId={currentId} />
        ) : view === "io" ? (
          <ImportExportPanel
            config={config}
            theme={theme}
            commit={commit}
            canExport={entitlements.canExport}
          />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
            {/* Middle editor (the secondary token sub-nav) */}
            <section className="min-h-0 overflow-y-auto border-r border-border p-4">
              {nav === "color" && (
                <ColorEditor config={config} commit={commit} />
              )}
              {nav === "typography" && (
                <TypographyEditor config={config} commit={commit} />
              )}
              {nav === "spacing" && (
                <SpacingEditor config={config} commit={commit} />
              )}
              {nav === "radius" && (
                <RadiusEditor config={config} commit={commit} />
              )}
              {nav === "semantic" && (
                <SemanticEditor theme={theme} config={config} commit={commit} />
              )}
            </section>

            {/* Right preview */}
            <section className="min-h-0 overflow-y-auto bg-muted/30 p-6">
              <ThemePreview theme={theme} config={config} mode={mode} />
            </section>
          </div>
        )}
      </div>

      <ResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={doReset}
      />

      <NewThemeDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={createNamed}
      />

      <UpgradeLimitDialog open={limitOpen} onOpenChange={setLimitOpen} />
    </div>
  );
}

/* ---------- Design-system limit / upgrade dialog ---------- */

function UpgradeLimitDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You&apos;re at your theme limit</DialogTitle>
          <DialogDescription>
            The free plan includes one saved design system. Upgrade to create
            and keep more.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {/* Wired to Stripe checkout in Phase 3 (LAUNCH-PLAN.md). */}
          <Button disabled>Upgrade (coming soon)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- New design system dialog ---------- */

function NewThemeDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setValue("");
      setCreating(false);
    }
  }, [open]);

  const trimmed = value.trim();

  function submit() {
    if (!trimmed || creating) return;
    setCreating(true);
    onCreate(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New design system</DialogTitle>
          <DialogDescription>
            Name your theme. It starts from a fresh set of default colors.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="e.g. Acme Brand"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!trimmed || creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Reset confirmation dialog ---------- */

function ResetDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (keepBrand: boolean) => void;
}) {
  const [keepBrand, setKeepBrand] = useState(false);

  // Default the checkbox off each time the dialog opens.
  useEffect(() => {
    if (open) setKeepBrand(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset theme?</DialogTitle>
          <DialogDescription>
            This discards your changes and restores the defaults. You can still
            Undo afterwards.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => setKeepBrand((v) => !v)}
          className="flex items-center gap-2 text-left text-sm"
        >
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
              keepBrand
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border"
            )}
          >
            {keepBrand && <Check className="size-3" strokeWidth={3} />}
          </span>
          Keep my brand colors (primary &amp; secondary), reset everything else
        </button>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(keepBrand)}>
            {keepBrand ? "Reset the rest" : "Reset all"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Design-system switcher ---------- */

function SystemSwitcher({
  name,
  onName,
  systems,
  currentId,
  onSelect,
  onNew,
}: {
  name: string;
  onName: (v: string) => void;
  systems: StudioDesignSystem[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center">
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        aria-label="Design system name"
        className="w-40 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm transition-colors hover:border-border focus:border-border focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Switch design system"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronDown className="size-4" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-56 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Your themes
          </div>
          {systems.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              None saved yet
            </div>
          ) : (
            systems.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onSelect(s.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                  s.id === currentId && "bg-muted/60"
                )}
              >
                <span className="truncate">{s.name}</span>
                {s.id === currentId && <Check className="size-3.5 shrink-0" />}
              </button>
            ))
          )}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={() => {
              onNew();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            <Plus className="size-3.5" /> New design system
          </button>
        </div>
      )}
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

/* ---------- Semantic tokens editor ---------- */

function SemanticEditor({
  theme,
  config,
  commit,
}: {
  theme: ReturnType<typeof deriveTheme>;
  config: ThemeConfig;
  commit: Commit;
}) {
  const names = Object.keys(theme.light);
  const overrideCount =
    Object.keys(config.semanticOverrides.light).length +
    Object.keys(config.semanticOverrides.dark).length;

  function setVar(m: "light" | "dark", name: string, value: string) {
    commit(
      (c) => ({
        ...c,
        semanticOverrides: {
          ...c.semanticOverrides,
          [m]: { ...c.semanticOverrides[m], [name]: value },
        },
      }),
      `sem:${m}:${name}`
    );
  }

  function clearVar(m: "light" | "dark", name: string) {
    commit((c) => {
      const next = { ...c.semanticOverrides[m] };
      delete next[name];
      return { ...c, semanticOverrides: { ...c.semanticOverrides, [m]: next } };
    });
  }

  function clearAll() {
    commit((c) => ({ ...c, semanticOverrides: { light: {}, dark: {} } }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Semantic tokens</h2>
          <p className="text-xs text-muted-foreground">
            shadcn tokens, light &amp; dark side by side. Un-edited tokens alias
            your primitives.
          </p>
        </div>
        {overrideCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
            title={`Revert all ${overrideCount} edited values`}
          >
            Revert all
          </button>
        )}
      </div>
      <div className="rounded-md border border-border">
        {/* Column header */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          <span className="flex-1">Token</span>
          <span className="flex w-8 justify-center" title="Light mode">
            <Sun className="size-3.5" />
          </span>
          <span className="flex w-8 justify-center" title="Dark mode">
            <Moon className="size-3.5" />
          </span>
        </div>
        {names.map((name) => (
          <div
            key={name}
            className="flex items-center gap-2 border-t border-border px-2.5 py-1.5"
          >
            <span className="flex-1 text-sm">{name}</span>
            <SwatchCell
              value={theme.light[name]}
              overridden={name in config.semanticOverrides.light}
              onChange={(v) => setVar("light", name, v)}
              onRevert={() => clearVar("light", name)}
              ariaLabel={`${name} light`}
            />
            <SwatchCell
              value={theme.dark[name]}
              overridden={name in config.semanticOverrides.dark}
              onChange={(v) => setVar("dark", name, v)}
              onRevert={() => clearVar("dark", name)}
              ariaLabel={`${name} dark`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SwatchCell({
  value,
  overridden,
  onChange,
  onRevert,
  ariaLabel,
}: {
  value: string;
  overridden: boolean;
  onChange: (v: string) => void;
  onRevert: () => void;
  ariaLabel: string;
}) {
  return (
    <div className="group relative flex w-8 justify-center">
      {/* Swatch only by default; ring marks an overridden value. */}
      <label
        className={cn(
          "relative block size-6 overflow-hidden rounded-sm border",
          overridden ? "border-primary ring-1 ring-primary" : "border-border"
        )}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer"
          aria-label={ariaLabel}
        />
      </label>
      {/* Hover reveals hex + revert. The panel sits flush against the group's
          top edge (pb-1 for visual gap) so the hover stays continuous. */}
      <div className="absolute bottom-full left-1/2 z-30 hidden -translate-x-1/2 flex-col items-center pb-1 group-hover:flex">
        <span className="rounded bg-popover px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-border">
          {value}
        </span>
        {overridden && (
          <button
            type="button"
            onClick={onRevert}
            className="mt-0.5 flex items-center gap-0.5 rounded bg-popover px-1.5 py-0.5 text-[10px] whitespace-nowrap text-muted-foreground shadow-md ring-1 ring-border transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-2.5" /> revert
          </button>
        )}
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

/* ---------- Import / Export content panel (fills the area beside the rail) ---------- */

function ImportExportPanel({
  config,
  theme,
  commit,
  canExport,
}: {
  config: ThemeConfig;
  theme: ReturnType<typeof deriveTheme>;
  commit: Commit;
  canExport: boolean;
}) {
  // Only build the export payload when the plan permits taking it away — for a
  // gated user we never render the CSS at all, so there's nothing to lift from
  // the DOM. Individual values stay visible in the editor (that's using, not
  // exporting). See FREEMIUM-GATING-PLAN.md.
  const css = canExport ? buildThemeCss(theme, config) : "";
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);
  const [importMsg, setImportMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  function doImport() {
    const parsed = parseThemeTokens(paste);
    if (parsed.count === 0) {
      setImportMsg({
        ok: false,
        text: "No recognizable tokens found — paste a theme.css or a :root { --… } block.",
      });
      return;
    }
    commit((c) => ({
      ...c,
      ...(parsed.radius !== undefined
        ? { radius: parsed.radius, radiusMode: "manual" as const }
        : {}),
      ...(parsed.spacing !== undefined
        ? { spacing: parsed.spacing, spacingMode: "manual" as const }
        : {}),
      semanticOverrides: {
        light: { ...c.semanticOverrides.light, ...parsed.light },
        dark: { ...c.semanticOverrides.dark, ...parsed.dark },
      },
    }));
    const modes = [
      Object.keys(parsed.light).length ? "light" : null,
      Object.keys(parsed.dark).length ? "dark" : null,
    ]
      .filter(Boolean)
      .join(" + ");
    setImportMsg({
      ok: true,
      text: `Imported ${parsed.count} tokens${modes ? ` (${modes})` : ""}. Open a token category to see them.`,
    });
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-6 overflow-hidden p-6">
        {/* Import */}
        <section className="flex min-h-0 flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold">Import</h2>
            <p className="text-xs text-muted-foreground">
              Paste a theme.css or a{" "}
              <code className="rounded bg-muted px-1">:root {"{ --… }"}</code>{" "}
              block. Semantic tokens, <code className="rounded bg-muted px-1">--radius</code>{" "}
              and <code className="rounded bg-muted px-1">--spacing</code> are
              applied (light from <code className="rounded bg-muted px-1">:root</code>,
              dark from <code className="rounded bg-muted px-1">.dark</code>).
            </p>
          </div>
          <Textarea
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              setImportMsg(null);
            }}
            placeholder={":root {\n  --primary: #4f46e5;\n  --radius: 0.625rem;\n}"}
            className="min-h-0 flex-1 resize-none font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={doImport} disabled={!paste.trim()}>
              Import tokens
            </Button>
            {importMsg && (
              <span
                className={cn(
                  "text-xs",
                  importMsg.ok ? "text-foreground" : "text-destructive"
                )}
              >
                {importMsg.text}
              </span>
            )}
          </div>
        </section>

        {/* Export */}
        <section className="flex min-h-0 flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Export</h2>
              <p className="text-xs text-muted-foreground">
                Copy this theme.css — Tailwind v4 + shadcn.
              </p>
            </div>
            {canExport && (
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            )}
          </div>
          {canExport ? (
            <pre className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
              {css}
            </pre>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium">Exporting is a premium feature</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Upgrade to copy or download your theme.css and other framework
                formats. You can keep editing and previewing for free.
              </p>
              {/* Wired to Stripe checkout in Phase 3 (LAUNCH-PLAN.md). */}
              <Button size="sm" className="mt-1" disabled>
                Upgrade (coming soon)
              </Button>
            </div>
          )}
        </section>
    </div>
  );
}
