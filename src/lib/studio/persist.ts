/**
 * Serialize/deserialize the studio's editor recipe (ThemeConfig) to and from
 * the `design_systems.studio_config` JSON column. This is the editor's source
 * of truth for reopening a design system exactly as it was left. The token
 * VALUES for the MCP live in the normalized tables (studio→rows translator,
 * separate). See PIVOT-PLAN "Architecture decision (2026-07-07)".
 */

import { DEFAULT_THEME, type ThemeConfig } from "@/lib/studio/theme";

const STUDIO_CONFIG_VERSION = 1;

export type StoredStudioConfig = { version: number; config: ThemeConfig };

/** A design system as listed in the studio switcher. */
export type StudioDesignSystem = {
  id: string;
  name: string;
  updatedAt: string;
};

export function serializeConfig(config: ThemeConfig): StoredStudioConfig {
  return { version: STUDIO_CONFIG_VERSION, config };
}

/**
 * Parse a stored `studio_config` back into a ThemeConfig, filling any missing
 * fields from DEFAULT_THEME so older/newer payload shapes still load cleanly.
 * Accepts either the versioned `{version, config}` envelope or a bare config.
 */
export function deserializeConfig(raw: unknown): ThemeConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_THEME;
  const stored = raw as Partial<StoredStudioConfig> & Partial<ThemeConfig>;
  const c = (
    stored.config && typeof stored.config === "object" ? stored.config : stored
  ) as Partial<ThemeConfig>;
  return mergeConfig(c);
}

/* ---------- Anonymous draft (localStorage) ---------- */

// The working editor state when it isn't yet backed by a saved design system —
// persisted client-side so a refresh / navigate-away / return never loses work,
// and claimed into the account on sign-in. See FREEMIUM-GATING-PLAN.md.
const DRAFT_KEY = "toknhost:studio-draft";

export type StudioDraft = { name: string; config: ThemeConfig };

/** Persist the current draft. No-ops if localStorage is unavailable. */
export function saveDraft(name: string, config: ThemeConfig): void {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ version: STUDIO_CONFIG_VERSION, name, config })
    );
  } catch {
    /* storage full / disabled — the draft just isn't persisted */
  }
}

/** Load the persisted draft, or null if none / unreadable. */
export function loadDraft(): StudioDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { name?: unknown; config?: unknown };
    return {
      name: typeof parsed.name === "string" ? parsed.name : "Untitled theme",
      config: deserializeConfig(parsed.config ?? parsed),
    };
  } catch {
    return null;
  }
}

/** Clear the persisted draft (after it's been claimed into an account). */
export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to do */
  }
}

/** Deep-ish merge a partial config over DEFAULT_THEME so every field is present. */
function mergeConfig(c: Partial<ThemeConfig>): ThemeConfig {
  return {
    ...DEFAULT_THEME,
    ...c,
    seeds: { ...DEFAULT_THEME.seeds, ...(c.seeds ?? {}) },
    ramps: { ...DEFAULT_THEME.ramps, ...(c.ramps ?? {}) },
    semanticOverrides: {
      light: { ...(c.semanticOverrides?.light ?? {}) },
      dark: { ...(c.semanticOverrides?.dark ?? {}) },
    },
    customFont: c.customFont ?? null,
  };
}
