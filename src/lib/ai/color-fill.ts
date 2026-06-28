import { generateObject } from "ai";
import { z } from "zod";
import { strongModel, STRONG_MODEL } from "./client";
import { materialColorScale } from "../gap-fill/material";
import { hexToOklch } from "../gap-fill/oklch";

const HEX_RE = /^#[0-9a-f]{6}$/i;

// Step 500 is deliberately NOT part of the schema the AI fills in — it's
// pinned to the literal seed hex below, never AI-generated. That invariant
// is the exact guarantee the Lovable-reported bug was about (see
// PIVOT-PLAN.md): consumers expect "500 is the brand color," and that must
// hold regardless of how the AI feels about the other 10 steps.
const ScaleSchema = z.object({
  "50": z.string().regex(HEX_RE),
  "100": z.string().regex(HEX_RE),
  "200": z.string().regex(HEX_RE),
  "300": z.string().regex(HEX_RE),
  "400": z.string().regex(HEX_RE),
  "600": z.string().regex(HEX_RE),
  "700": z.string().regex(HEX_RE),
  "800": z.string().regex(HEX_RE),
  "900": z.string().regex(HEX_RE),
  "950": z.string().regex(HEX_RE),
});

// z.record(z.string(), ScaleSchema) (open-ended keys) reliably made Anthropic's
// structured-output translation return an empty object — confirmed via a real
// API call: identical prompt, only the schema shape differed, and z.record
// produced `{}` while an explicit z.object with the real seed names as keys
// produced full data. Building the schema per-call from the actual seed names
// keeps the same flexibility (any set of seed paths) without the record shape.
function buildColorFillSchema(seedNames: string[]) {
  const shape: Record<string, typeof ScaleSchema> = {};
  for (const name of seedNames) shape[name] = ScaleSchema;
  return z.object({ scales: z.object(shape) });
}

export type ColorFillUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/** Lightness (0-100) used purely to check monotonic ordering — not stored. */
function lightnessOf(hex: string): number {
  return hexToOklch(hex).l * 100;
}

/**
 * Checks that step lightness strictly decreases from 50 -> 950, with the
 * pinned seed slotted in at 500. A scale that fails this is unusable
 * regardless of how good any individual step looks in isolation — this is
 * the deterministic safety net the "AI proposes, checker validates" plan
 * always called for.
 */
function isMonotonic(scale: Record<number, string>): boolean {
  const ordered = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(
    (step) => lightnessOf(scale[step])
  );
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i] >= ordered[i - 1]) return false;
  }
  return true;
}

/**
 * Generates aesthetically-tuned 50-950 scales for one or more seed colors
 * using AI, falling back to the existing deterministic `materialColorScale`
 * per-seed if the AI output fails the monotonicity check. No retry/re-prompt
 * on failure — per the decided cost model, this is exactly one AI call no
 * matter how many seeds are passed in, and a failure costs zero extra calls,
 * just silently (but loggably) falls back to math that's already proven safe.
 */
export async function generateColorFill(
  seeds: Record<string, string>
): Promise<{ results: Record<string, Record<number, string>>; usage: ColorFillUsage; fellBackFor: string[] }> {
  const seedNames = Object.keys(seeds);

  const { object, usage } = await generateObject({
    model: strongModel(),
    schema: buildColorFillSchema(seedNames),
    system:
      "You are a color systems designer generating tint/shade scales for a product design system. " +
      "For each named seed color, you will be told its exact hex value, which is ALREADY the design system's " +
      "step-500 (the brand color itself, fixed and non-negotiable). Your job is to generate the other 10 steps " +
      "(50, 100, 200, 300, 400, 600, 700, 800, 900, 950), such that the full 11-step scale (with 500 = the seed) " +
      "reads as a single coherent, hand-crafted-looking ramp: lightness must strictly decrease from 50 " +
      "(near-white tint) to 950 (near-black shade), passing smoothly through the seed at 500. Keep hue " +
      "consistent with subtle, tasteful drift (slightly warmer in light tints, slightly cooler/more saturated " +
      "in dark shades is a common professional choice, but prioritize what looks best for this specific hue). " +
      "Avoid muddy, over-desaturated, or garish steps. Every hex must be a 6-digit hex string starting with #.",
    prompt:
      "Generate scales for these seed colors (path -> hex, where hex is the fixed step-500):\n" +
      seedNames.map((name) => `- ${name}: ${seeds[name]}`).join("\n"),
  });

  const results: Record<string, Record<number, string>> = {};
  const fellBackFor: string[] = [];

  for (const name of seedNames) {
    const seedHex = seeds[name].toLowerCase();
    const proposed = object.scales[name];

    const candidate: Record<number, string> | null = proposed
      ? {
          50: proposed["50"].toLowerCase(),
          100: proposed["100"].toLowerCase(),
          200: proposed["200"].toLowerCase(),
          300: proposed["300"].toLowerCase(),
          400: proposed["400"].toLowerCase(),
          500: seedHex,
          600: proposed["600"].toLowerCase(),
          700: proposed["700"].toLowerCase(),
          800: proposed["800"].toLowerCase(),
          900: proposed["900"].toLowerCase(),
          950: proposed["950"].toLowerCase(),
        }
      : null;

    if (candidate && isMonotonic(candidate)) {
      results[name] = candidate;
    } else {
      fellBackFor.push(name);
      results[name] = materialColorScale(seedHex);
    }
  }

  return {
    results,
    usage: {
      model: STRONG_MODEL,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
    fellBackFor,
  };
}

/** $/M token pricing for the strong tier — see PIVOT-PLAN.md cost estimate. */
const PRICE_PER_M_INPUT = 3;
const PRICE_PER_M_OUTPUT = 15;

export function estimateCostUsd(usage: ColorFillUsage): number {
  return (
    (usage.inputTokens / 1_000_000) * PRICE_PER_M_INPUT +
    (usage.outputTokens / 1_000_000) * PRICE_PER_M_OUTPUT
  );
}
