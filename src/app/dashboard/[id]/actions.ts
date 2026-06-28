"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseInput } from "@/lib/parsers";
import { cssColorToValue } from "@/lib/parsers/shared";
import {
  computeGapFill,
  findColorScaleSeeds,
  NON_SCALE_COLOR_ROOTS,
  hexToOklch,
  oklchToHex,
  contrastRatio,
  type ExistingToken,
} from "@/lib/gap-fill";
import { generateColorFill, estimateCostUsd } from "@/lib/ai/color-fill";
import {
  extractFreeformTokens,
  estimateFreeformCostUsd,
  FREEFORM_INPUT_CHAR_CAP,
} from "@/lib/ai/freeform-ingest";
import { materialDarkInvert, ctaDarkPair } from "@/lib/gap-fill/material";
import { aestheticForeground, normalizeSeedColor } from "@/lib/gap-fill/oklch";
import { fontFallback, googleFontsUrl } from "@/lib/google-fonts";
import { runAccessibilityChecks } from "@/app/dashboard/[id]/a11y-actions";
import type { ParsedToken, TokenValueShape } from "@/types/tokens";
import type { Json, TablesInsert } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type ImportResult =
  | { error: string }
  | { success: true; count: number; warnings: string[] }
  | void;

/** Shared persistence step for any source of ParsedToken[] — the paste
 * importer, Quick Start, and (eventually) any future import path all
 * converge here. Writes tokens + their values into a single mode. */
async function writeParsedTokens(
  supabase: SupabaseClient<Database>,
  designSystemId: string,
  modeId: string,
  tokens: ParsedToken[],
  provenance: "imported" | "derived" | "defaulted" = "imported"
): Promise<{ error: string } | { count: number }> {
  const tokenRows: TablesInsert<"tokens">[] = tokens.map((t) => ({
    design_system_id: designSystemId,
    path: t.path,
    category: t.category,
    type: t.type,
    description: t.description ?? null,
    provenance,
    provenance_meta: (t.provenanceMeta as Json) ?? null,
  }));

  const { data: insertedTokens, error: tokenError } = await supabase
    .from("tokens")
    .upsert(tokenRows, { onConflict: "design_system_id,path" })
    .select("id, path");

  if (tokenError) return { error: tokenError.message };

  const pathToId = new Map(insertedTokens.map((t) => [t.path, t.id]));

  const valueRows: TablesInsert<"token_values">[] = tokens
    .map((t): TablesInsert<"token_values"> | null => {
      const tokenId = pathToId.get(t.path);
      if (!tokenId) return null;
      return {
        token_id: tokenId,
        mode_id: modeId,
        value: t.isAlias ? null : (t.value as Json),
        is_alias: t.isAlias,
        alias_path: t.aliasPath ?? null,
        raw_value: t.rawValue ?? null,
      };
    })
    .filter((r): r is TablesInsert<"token_values"> => r !== null);

  const { error: valueError } = await supabase
    .from("token_values")
    .upsert(valueRows, { onConflict: "token_id,mode_id" });

  if (valueError) return { error: valueError.message };

  return { count: tokens.length };
}

async function getDefaultModeId(
  supabase: SupabaseClient<Database>,
  designSystemId: string
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("modes")
    .select("id")
    .eq("design_system_id", designSystemId)
    .eq("is_default", true)
    .single();

  if (error || !data) return { error: "Could not find the default mode for this design system." };
  return { id: data.id };
}

export async function importTokens(
  designSystemId: string,
  _prevState: ImportResult,
  formData: FormData
): Promise<ImportResult> {
  const raw = (formData.get("raw") as string)?.trim();
  if (!raw) return { error: "Paste some tokens first." };

  const result = parseInput(raw);
  if (result.format === "unknown" || result.tokens.length === 0) {
    return { error: result.warnings.join(" ") || "No tokens found." };
  }

  const supabase = await createClient();
  const mode = await getDefaultModeId(supabase, designSystemId);
  if ("error" in mode) return mode;

  const write = await writeParsedTokens(supabase, designSystemId, mode.id, result.tokens, "imported");
  if ("error" in write) return write;

  revalidatePath(`/dashboard/${designSystemId}`);
  return { success: true, count: write.count, warnings: result.warnings };
}

export type QuickStartResult =
  | { error: string }
  | { success: true; createdCount: number; darkModeCount: number }
  | void;

const RADIUS_PRESETS: Record<string, number> = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 16,
  full: 9999,
};

function colorTokenFrom(path: string, hex: string): ParsedToken | null {
  const value = cssColorToValue(hex);
  if (!value) return null;
  return {
    path,
    category: "color",
    type: "color",
    isAlias: false,
    value,
    rawValue: hex,
    provenanceMeta: { format: "quick-start" },
  };
}

/**
 * The no-parsing-required import path: a couple of fields (primary color,
 * optional secondary color, a border-radius feel) instead of pasting a
 * file in some specific format. Whatever's provided is written as
 * `imported`, then immediately run through gap-fill — so even the
 * smallest amount of input produces a complete, accessible design system.
 * This sidesteps needing an AI natural-language parser entirely (see
 * the nl-import-provider-decision memory) for the common "I just know my
 * brand colors" case.
 */
export async function quickStartImport(
  designSystemId: string,
  _prevState: QuickStartResult,
  formData: FormData
): Promise<QuickStartResult> {
  const rawPrimaryHex = (formData.get("primaryColor") as string)?.trim();
  const rawSecondaryHex = (formData.get("secondaryColor") as string)?.trim();
  const radiusKey = (formData.get("radius") as string) || "md";
  const fontName = ((formData.get("fontName") as string) || "Inter").trim();

  if (!rawPrimaryHex) return { error: "Pick a primary color to get started." };

  // Normalise seed colors to professional button-appropriate values.
  // Preserves hue/character; overrides lightness so white text always
  // passes AA and the result looks refined rather than garish.
  const primaryHex = normalizeSeedColor(rawPrimaryHex, "primary");
  const secondaryHex = rawSecondaryHex ? normalizeSeedColor(rawSecondaryHex, "secondary") : null;

  const tokens: ParsedToken[] = [];
  const primary = colorTokenFrom("color.primary", primaryHex);
  if (!primary) return { error: `"${rawPrimaryHex}" isn't a valid color.` };
  tokens.push(primary);

  if (secondaryHex) {
    const secondary = colorTokenFrom("color.secondary", secondaryHex);
    if (!secondary) return { error: `"${rawSecondaryHex}" isn't a valid color.` };
    tokens.push(secondary);
  }

  tokens.push({
    path: "border-radius.base",
    category: "border-radius",
    type: "dimension",
    isAlias: false,
    value: { value: RADIUS_PRESETS[radiusKey] ?? RADIUS_PRESETS.md, unit: "px" },
    rawValue: radiusKey,
    provenanceMeta: { format: "quick-start" },
  });

  // Font family — default to Inter, the industry-standard SaaS sans-serif.
  const fontStack = [fontName, fontFallback(fontName)];
  const fontUrl = googleFontsUrl(fontName);
  tokens.push({
    path: "font-family.base",
    category: "font-family",
    type: "fontFamily",
    isAlias: false,
    value: { primary: fontName, stack: fontStack, fontUrl } as unknown as TokenValueShape,
    rawValue: fontName,
    provenanceMeta: { format: "quick-start" },
  });

  const supabase = await createClient();
  const mode = await getDefaultModeId(supabase, designSystemId);
  if ("error" in mode) return mode;

  const write = await writeParsedTokens(supabase, designSystemId, mode.id, tokens, "imported");
  if ("error" in write) return write;

  const gapFilled = await runGapFill(designSystemId);
  if (gapFilled && "error" in gapFilled) {
    return { success: true, createdCount: 0, darkModeCount: 0 };
  }

  revalidatePath(`/dashboard/${designSystemId}`);
  return {
    success: true,
    createdCount: gapFilled && "success" in gapFilled ? gapFilled.createdCount : 0,
    darkModeCount: gapFilled && "success" in gapFilled ? gapFilled.darkModeCount : 0,
  };
}

// Free-tier cap on freeform-ingestion AI calls per user per month. Same
// pattern as AI_COLOR_FILL_MONTHLY_CAP (checked against real `ai_usage`
// rows). Reusing the same 25/month figure for consistency — this wasn't
// re-derived from a separate cost target, since freeform ingestion's
// estimated per-call cost (~$0.005-0.01, cheap-tier model) is already lower
// than color-fill's, so the same cap leaves more headroom, not less.
const FREEFORM_INGEST_MONTHLY_CAP = 25;

export type FreeformImportResult =
  | { error: string }
  | { success: true; createdCount: number; darkModeCount: number; ambiguous: string[] }
  | void;

/**
 * The "just describe it" import path — one AI call (no chat, no follow-up
 * round) extracts the same four fields Quick Start collects via form
 * inputs (primary/secondary color, font, border radius) from freeform
 * prose, then runs them through the exact same trusted conversion path
 * quickStartImport already uses below — a bad extraction fails the same
 * validation a human mistyping into the Quick Start fields would.
 */
export async function freeformImport(
  designSystemId: string,
  _prevState: FreeformImportResult,
  formData: FormData
): Promise<FreeformImportResult> {
  const text = (formData.get("text") as string)?.trim();
  if (!text) return { error: "Describe your design system first." };
  if (text.length > FREEFORM_INPUT_CHAR_CAP) {
    return {
      error: `That's ${text.length} characters — keep it under ${FREEFORM_INPUT_CHAR_CAP} so this stays a single, predictable call.`,
    };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { error: "Not signed in." };

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", "freeform_ingest")
    .gte("created_at", monthStart.toISOString());

  if ((count ?? 0) >= FREEFORM_INGEST_MONTHLY_CAP) {
    return { error: `You've hit this month's limit of ${FREEFORM_INGEST_MONTHLY_CAP} AI imports. Try Quick Start or paste a token file instead.` };
  }

  let extraction;
  try {
    const result = await extractFreeformTokens(text);
    extraction = result.extraction;
    await supabase.from("ai_usage").insert({
      user_id: userId,
      design_system_id: designSystemId,
      feature: "freeform_ingest",
      model: result.usage.model,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      estimated_cost_usd: estimateFreeformCostUsd(result.usage),
    });
  } catch (err) {
    console.error("Freeform extraction failed:", err);
    return { error: "Couldn't process that description — try Quick Start or paste a token file instead." };
  }

  if (!extraction.primaryColor) {
    return {
      error:
        "Couldn't find a primary color in that description — it's the one required field. " +
        (extraction.ambiguous.length > 0 ? `Also noted but not used: ${extraction.ambiguous.join("; ")}.` : ""),
    };
  }

  const primaryHex = normalizeSeedColor(extraction.primaryColor, "primary");
  const tokens: ParsedToken[] = [];
  const primary = colorTokenFrom("color.primary", primaryHex);
  if (!primary) return { error: `Couldn't recognize "${extraction.primaryColor}" as a color.` };
  tokens.push(primary);

  if (extraction.secondaryColor) {
    const secondaryHex = normalizeSeedColor(extraction.secondaryColor, "secondary");
    const secondary = colorTokenFrom("color.secondary", secondaryHex);
    if (secondary) tokens.push(secondary);
  }

  if (extraction.borderRadiusPx !== null) {
    tokens.push({
      path: "border-radius.base",
      category: "border-radius",
      type: "dimension",
      isAlias: false,
      value: { value: extraction.borderRadiusPx, unit: "px" },
      rawValue: String(extraction.borderRadiusPx),
      provenanceMeta: { format: "freeform-ingest" },
    });
  }

  const fontName = extraction.fontName || "Inter";
  const fontStack = [fontName, fontFallback(fontName)];
  const fontUrl = googleFontsUrl(fontName);
  tokens.push({
    path: "font-family.base",
    category: "font-family",
    type: "fontFamily",
    isAlias: false,
    value: { primary: fontName, stack: fontStack, fontUrl } as unknown as TokenValueShape,
    rawValue: fontName,
    provenanceMeta: { format: "freeform-ingest" },
  });

  const mode = await getDefaultModeId(supabase, designSystemId);
  if ("error" in mode) return mode;

  const write = await writeParsedTokens(supabase, designSystemId, mode.id, tokens, "imported");
  if ("error" in write) return write;

  const gapFilled = await runGapFill(designSystemId);
  if (gapFilled && "error" in gapFilled) {
    return { success: true, createdCount: 0, darkModeCount: 0, ambiguous: extraction.ambiguous };
  }

  revalidatePath(`/dashboard/${designSystemId}`);
  return {
    success: true,
    createdCount: gapFilled && "success" in gapFilled ? gapFilled.createdCount : 0,
    darkModeCount: gapFilled && "success" in gapFilled ? gapFilled.darkModeCount : 0,
    ambiguous: extraction.ambiguous,
  };
}

export type GapFillResult =
  | { error: string }
  | { success: true; createdCount: number; darkModeCount: number }
  | void;

function colorValueOf(hex: string): TokenValueShape {
  const { l, c, h } = hexToOklch(hex);
  return { hex, oklch: `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`, space: "oklch" };
}

function hexOf(value: unknown): string | null {
  if (value && typeof value === "object" && "hex" in value) {
    return String((value as { hex: unknown }).hex);
  }
  return null;
}

const FOREGROUND_SUFFIX = ".foreground";

// Mirrors EXPLICIT_PAIRS from src/lib/a11y/index.ts — pairs where the
// foreground path doesn't follow the "*.foreground" → strip → base pattern.
// color.foreground lives at a different path than its background (color.background),
// so the generic suffix-strip logic misses it.
const EXPLICIT_FG_BG_PAIRS: [fg: string, bg: string][] = [
  ["color.foreground", "color.background"],
];

/**
 * Scans every foreground/background color pair in the given mode. Any pair
 * failing WCAG AA (< 4.5:1) has its foreground replaced with an aesthetically
 * pleasing passing color. Returns a map of tokenId → corrected hex so the
 * caller can propagate corrections to dark-mode inversion.
 *
 * Covers two pair types:
 *   1. Generic: any "path.foreground" token paired with its "path" base token
 *   2. Explicit: color.foreground / color.background (different path structure)
 */
async function remediateContrastPairs(
  supabase: SupabaseClient<Database>,
  designSystemId: string,
  modeId: string
): Promise<Map<string, string> | { error: string }> {
  const { data: colorTokens, error: tokensErr } = await supabase
    .from("tokens")
    .select("id, path")
    .eq("design_system_id", designSystemId)
    .eq("category", "color")
    .eq("type", "color");
  if (tokensErr) return { error: tokensErr.message };

  const { data: values, error: valuesErr } = await supabase
    .from("token_values")
    .select("token_id, value")
    .eq("mode_id", modeId)
    .in("token_id", (colorTokens ?? []).map((t) => t.id));
  if (valuesErr) return { error: valuesErr.message };

  const pathToToken = new Map((colorTokens ?? []).map((t) => [t.path, t]));
  const idToHex = new Map<string, string>();
  for (const v of values ?? []) {
    const hex = hexOf(v.value);
    if (hex) idToHex.set(v.token_id, hex);
  }

  // Build full pair list: generic suffix pairs + explicit pairs.
  const pairs: [fgPath: string, bgPath: string][] = [];
  for (const [path] of pathToToken) {
    if (!path.endsWith(FOREGROUND_SUFFIX)) continue;
    const bgPath = path.slice(0, -FOREGROUND_SUFFIX.length);
    if (pathToToken.has(bgPath)) pairs.push([path, bgPath]);
  }
  for (const [fg, bg] of EXPLICIT_FG_BG_PAIRS) {
    if (pathToToken.has(fg) && pathToToken.has(bg)) pairs.push([fg, bg]);
  }

  const fixes: { token_id: string; value: Json }[] = [];
  const corrected = new Map<string, string>();

  for (const [fgPath, bgPath] of pairs) {
    const fgToken = pathToToken.get(fgPath)!;
    const bgToken = pathToToken.get(bgPath)!;
    const fgHex = idToHex.get(fgToken.id);
    const bgHex = idToHex.get(bgToken.id);
    if (!fgHex || !bgHex) continue;

    if (contrastRatio(fgHex, bgHex) < 4.5) {
      const fixedHex = aestheticForeground(bgHex);
      fixes.push({ token_id: fgToken.id, value: colorValueOf(fixedHex) as Json });
      corrected.set(fgToken.id, fixedHex);
    }
  }

  for (const fix of fixes) {
    const { error } = await supabase
      .from("token_values")
      .update({ value: fix.value })
      .eq("token_id", fix.token_id)
      .eq("mode_id", modeId);
    if (error) return { error: error.message };
  }

  return corrected;
}

// Free-tier cap on AI color-fill runs per user per month — see
// PIVOT-PLAN.md ("25 AI color-fill runs/month, presented as a plain run
// count"). Checked against `ai_usage` rows, not a separate counter column,
// so the cap can be verified/audited against real per-call cost later.
const AI_COLOR_FILL_MONTHLY_CAP = 25;

/**
 * Runs the OKLCH-based gap-fill pass (CLAUDE.md "Gap-Fill: What Gets
 * Derived From What"), generates a dark-mode counterpart for every color
 * token by inverting lightness, and AI-fills color scales (replacing the
 * deterministic step for that one piece — see PIVOT-PLAN.md "AI-fill scope
 * is color generation only"). Every other category stays algorithmic, per
 * CLAUDE.md decision #3 — only the color-scale step now optionally calls AI.
 */
const SCALE_AND_FOREGROUND_SUFFIXES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950, "foreground"];

/**
 * `forceColorRegen`: when true, every current base color (not just ones
 * missing a scale) gets a fresh AI-generated scale, overwriting whatever
 * was there before. Used by the explicit "Update design system" action —
 * changing a base color cascades through its whole palette, so a partial
 * refresh would leave the rest visibly stale. Plain "Run gap-fill" leaves
 * this false: it only fills genuine gaps, never touches existing scales.
 */
export async function runGapFill(
  designSystemId: string,
  forceColorRegen = false
): Promise<GapFillResult> {
  const supabase = await createClient();

  const { data: modes, error: modesError } = await supabase
    .from("modes")
    .select("id, name, is_default")
    .eq("design_system_id", designSystemId);
  if (modesError || !modes?.length) {
    return { error: "Could not load modes for this design system." };
  }

  const lightMode = modes.find((m) => m.is_default) ?? modes[0];
  let darkMode = modes.find((m) => m.name === "dark");

  const { data: tokens, error: tokensError } = await supabase
    .from("tokens")
    .select("id, path, category, type")
    .eq("design_system_id", designSystemId);
  if (tokensError) return { error: tokensError.message };
  if (!tokens?.length) return { error: "Import some tokens before gap-filling." };

  const { data: lightValues, error: valuesError } = await supabase
    .from("token_values")
    .select("token_id, value")
    .eq("mode_id", lightMode.id)
    .in(
      "token_id",
      tokens.map((t) => t.id)
    );
  if (valuesError) return { error: valuesError.message };

  const valueByTokenId = new Map(lightValues.map((v) => [v.token_id, v.value]));

  const existing: ExistingToken[] = tokens.map((t) => ({
    id: t.id,
    path: t.path,
    category: t.category,
    type: t.type,
    value: valueByTokenId.get(t.id),
  }));

  let colorOverrides: Record<string, Record<number, string>> | undefined;
  let colorSeeds: Record<string, string>;
  // `existingForCompute` is what gets passed to computeGapFill below — for a
  // forced regen, the target base colors' existing scale/foreground entries
  // are stripped out so computeGapFill treats them as missing and derives
  // them fresh. Persistence further down is upsert-based throughout, so the
  // fresh values overwrite the stale ones rather than erroring on conflict.
  let existingForCompute = existing;
  // Populated only when forceColorRegen — paths whose scale/foreground are
  // being regenerated from scratch. Used below to keep colorTokensForDarkMode
  // from picking up these paths' STALE hex from the initial DB scan; their
  // fresh hex arrives separately via `derived`, so including both would
  // upsert the same token_id+mode_id twice in one batch (Postgres errors on
  // "ON CONFLICT DO UPDATE command cannot affect row a second time").
  let forcedPaths: Set<string> = new Set();
  if (forceColorRegen) {
    const allBaseColors = existing.filter(
      (t) =>
        t.category === "color" &&
        t.type === "color" &&
        !/\.(50|100|200|300|400|500|600|700|800|900|950|foreground)$/.test(t.path) &&
        !NON_SCALE_COLOR_ROOTS.has(t.path) &&
        t.value &&
        typeof t.value === "object" &&
        "hex" in t.value
    );
    colorSeeds = Object.fromEntries(
      allBaseColors.map((t) => [t.path, String((t.value as { hex: string }).hex)])
    );
    forcedPaths = new Set(
      allBaseColors.flatMap((t) => SCALE_AND_FOREGROUND_SUFFIXES.map((s) => `${t.path}.${s}`))
    );
    existingForCompute = existing.filter((t) => !forcedPaths.has(t.path));
  } else {
    colorSeeds = findColorScaleSeeds(existing);
  }

  if (Object.keys(colorSeeds).length > 0) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (userId) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("feature", "color_fill")
        .gte("created_at", monthStart.toISOString());

      if ((count ?? 0) < AI_COLOR_FILL_MONTHLY_CAP) {
        // Any API failure here (rate limit, a request too large for
        // Anthropic's structured-output grammar compiler, network error,
        // etc.) must not abort the whole action — found live: an uncaught
        // error here previously crashed gap-fill AND the accessibility
        // recheck that "Update design system" is supposed to always run.
        // colorOverrides simply stays undefined on failure, and
        // computeGapFill already falls back to deterministic math per seed.
        try {
          const { results, usage, fellBackFor } = await generateColorFill(colorSeeds);
          colorOverrides = results;
          if (fellBackFor.length > 0) {
            console.warn(`AI color-fill fell back to deterministic math for: ${fellBackFor.join(", ")}`);
          }
          await supabase.from("ai_usage").insert({
            user_id: userId,
            design_system_id: designSystemId,
            feature: "color_fill",
            model: usage.model,
            input_tokens: usage.inputTokens,
            output_tokens: usage.outputTokens,
            estimated_cost_usd: estimateCostUsd(usage),
          });
        } catch (err) {
          console.error("AI color-fill call failed, falling back to deterministic math:", err);
        }
      }
      // Over cap: colorOverrides stays undefined, computeGapFill falls back
      // to the deterministic materialColorScale for these seeds — gap-fill
      // itself never fails or blocks just because the AI cap was hit.
    }
  }

  const derived = computeGapFill(existingForCompute, colorOverrides);

  // Color tokens that already have a light-mode value, before any new
  // derived tokens are added — used below to seed dark-mode inversion.
  const colorTokensForDarkMode: { id: string; hex: string; path: string }[] = tokens
    .filter((t) => t.category === "color" && t.type === "color" && !forcedPaths.has(t.path))
    .map((t) => ({ id: t.id, path: t.path, value: valueByTokenId.get(t.id) }))
    .map((t) => {
      const hex =
        t.value && typeof t.value === "object" && "hex" in t.value
          ? String((t.value as { hex: unknown }).hex)
          : null;
      return hex ? { id: t.id, hex, path: t.path } : null;
    })
    .filter((t): t is { id: string; hex: string; path: string } => t !== null);

  let createdCount = 0;
  if (derived.length > 0) {
    const tokenRows: TablesInsert<"tokens">[] = derived.map((d) => ({
      design_system_id: designSystemId,
      path: d.path,
      category: d.category,
      type: d.type,
      provenance: d.provenance,
    }));

    const { data: insertedTokens, error: insertTokensError } = await supabase
      .from("tokens")
      .upsert(tokenRows, { onConflict: "design_system_id,path" })
      .select("id, path");
    if (insertTokensError) return { error: insertTokensError.message };

    const pathToId = new Map(insertedTokens.map((t) => [t.path, t.id]));
    const valueRows: TablesInsert<"token_values">[] = derived.map((d) => ({
      token_id: pathToId.get(d.path)!,
      mode_id: lightMode.id,
      value: d.value as Json,
      is_alias: false,
    }));

    const { error: insertValuesError } = await supabase
      .from("token_values")
      .upsert(valueRows, { onConflict: "token_id,mode_id" });
    if (insertValuesError) return { error: insertValuesError.message };

    createdCount = derived.length;

    // Newly derived color tokens also need a dark-mode counterpart.
    for (const d of derived) {
      if (d.category !== "color" || d.type !== "color") continue;
      const tokenId = pathToId.get(d.path);
      const hex = (d.value as { hex?: string }).hex;
      if (tokenId && hex) colorTokensForDarkMode.push({ id: tokenId, hex, path: d.path });
    }
  }

  // Remediate any foreground/background pairs that fail WCAG AA (< 4.5:1).
  // This runs after all derived tokens are persisted but BEFORE dark-mode
  // inversion, so the inversion uses the corrected foreground values.
  const corrected = await remediateContrastPairs(supabase, designSystemId, lightMode.id);
  if ("error" in corrected) return corrected;

  // Apply remediated hex values to the dark-mode source list so the inversion
  // produces a correct dark counterpart for any fixed foreground.
  for (const entry of colorTokensForDarkMode) {
    const fixedHex = corrected.get(entry.id);
    if (fixedHex) entry.hex = fixedHex;
  }

  // Ensure a "dark" mode exists, then invert lightness for every color
  // token (imported or just-derived) into it.
  if (!darkMode) {
    const { data: newDarkMode, error: darkModeError } = await supabase
      .from("modes")
      .insert({ design_system_id: designSystemId, name: "dark", is_default: false, sort_order: 1 })
      .select("id, name, is_default")
      .single();
    if (darkModeError) return { error: darkModeError.message };
    darkMode = newDarkMode;
  }

  // Pre-compute adaptive CTA pairs so that the foreground token gets the
  // matching strategy (A tint-text or B dark-text) chosen for its container.
  // Both are determined together by the contrast check in adaptiveDarkCTA.
  const CTA_CONTAINER_PATHS = new Set(["color.primary", "color.secondary"]);
  const CTA_FOREGROUND_PATHS = new Set(["color.primary.foreground", "color.secondary.foreground"]);

  const ctaPairs = new Map<string, ReturnType<typeof ctaDarkPair>>();
  for (const { hex, path } of colorTokensForDarkMode) {
    if (CTA_CONTAINER_PATHS.has(path)) {
      ctaPairs.set(path, ctaDarkPair(hex));
    }
  }

  const darkValueRows: TablesInsert<"token_values">[] = colorTokensForDarkMode.map(
    ({ id, hex, path }) => {
      let value: { hex: string; oklch: string; space: string } | ReturnType<typeof colorValueOf>;
      if (CTA_CONTAINER_PATHS.has(path)) {
        value = ctaPairs.get(path)!.container;
      } else if (CTA_FOREGROUND_PATHS.has(path)) {
        // "color.primary.foreground" → look up "color.primary" pair
        const basePath = path.slice(0, -".foreground".length);
        value = ctaPairs.get(basePath)?.foreground ?? colorValueOf(materialDarkInvert(hex));
      } else {
        value = colorValueOf(materialDarkInvert(hex));
      }
      return { token_id: id, mode_id: darkMode!.id, value: value as Json, is_alias: false };
    }
  );

  if (darkValueRows.length > 0) {
    const { error: darkValuesError } = await supabase
      .from("token_values")
      .upsert(darkValueRows, { onConflict: "token_id,mode_id" });
    if (darkValuesError) return { error: darkValuesError.message };
  }

  // Remediate dark mode independently — lightness inversion of a mid-tone
  // background paired with an inverted dark foreground often lands around
  // 2–3:1, well below AA. The dark mode needs its own aestheticForeground pass.
  const darkCorrected = await remediateContrastPairs(supabase, designSystemId, darkMode!.id);
  if ("error" in darkCorrected) return darkCorrected;

  // Auto-run a11y checks so results are always fresh after gap-fill.
  // Fire-and-forget style — a failure here shouldn't block the gap-fill result.
  await runAccessibilityChecks(designSystemId).catch(() => null);

  revalidatePath(`/dashboard/${designSystemId}`);
  return { success: true, createdCount, darkModeCount: darkValueRows.length };
}
