import { generateObject } from "ai";
import { z } from "zod";
import { fastModel, FAST_MODEL } from "./client";

export const FREEFORM_INPUT_CHAR_CAP = 4000;

const ExtractionSchema = z.object({
  primaryColor: z.string().nullable(),
  secondaryColor: z.string().nullable(),
  fontName: z.string().nullable(),
  borderRadiusPx: z.number().nullable(),
  // Things mentioned that don't map to a field above (e.g. "use a 1.5x type
  // scale", "dark mode should feel moody") — surfaced to the user as
  // warnings rather than silently dropped or guessed at.
  ambiguous: z.array(z.string()),
});

export type FreeformExtraction = z.infer<typeof ExtractionSchema>;

export type FreeformIngestUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Extracts the same minimal field set Quick Start already collects
 * (primary/secondary color, font, border radius) from a freeform prose
 * description — "font: Inter, primary: blue, radius: 8px" or a paragraph
 * describing a brand. One-shot, no chat: a single call, no follow-up
 * clarification round. Anything mentioned that isn't one of these fields
 * is returned in `ambiguous` for the caller to surface, not guessed at.
 *
 * Deliberately does NOT validate/convert the extracted values itself —
 * that's the caller's job, reusing the exact same trusted conversion path
 * `quickStartImport` already uses (`cssColorToValue`, `fontFallback`,
 * etc.), so a bad extraction (e.g. "sky" misread as a color) fails the same
 * validation a human typing "sky" into the Quick Start color field would.
 */
export async function extractFreeformTokens(
  text: string
): Promise<{ extraction: FreeformExtraction; usage: FreeformIngestUsage }> {
  const capped = text.slice(0, FREEFORM_INPUT_CHAR_CAP);

  const { object, usage } = await generateObject({
    model: fastModel(),
    schema: ExtractionSchema,
    system:
      "Extract design system basics from the user's freeform description. Only extract these four " +
      "fields if mentioned: a primary brand color, a secondary brand color, a font/typeface name, and a " +
      "border radius in pixels. Colors can be any CSS-recognizable description (a hex code, an RGB/HSL " +
      "function, or a common color name like 'forest green' or 'sky blue') — pass through whatever the " +
      "user wrote, do not convert it yourself. If a field isn't mentioned, return null for it. Put any " +
      "other design-relevant detail you noticed (spacing preferences, tone, type scale, anything that " +
      "doesn't fit the four fields) into the ambiguous array as a short phrase, verbatim or close to it — " +
      "do not invent values for fields that weren't mentioned, and do not drop mentioned details silently.",
    prompt: capped,
  });

  return {
    extraction: object,
    usage: {
      model: FAST_MODEL,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
  };
}

/** $/M token pricing for the fast tier — see PIVOT-PLAN.md cost estimate. */
const PRICE_PER_M_INPUT = 1;
const PRICE_PER_M_OUTPUT = 5;

export function estimateFreeformCostUsd(usage: FreeformIngestUsage): number {
  return (
    (usage.inputTokens / 1_000_000) * PRICE_PER_M_INPUT +
    (usage.outputTokens / 1_000_000) * PRICE_PER_M_OUTPUT
  );
}
