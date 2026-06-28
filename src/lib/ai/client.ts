import { createAnthropic } from "@ai-sdk/anthropic";

/**
 * Always constructs the provider explicitly rather than using the
 * `anthropic(modelId)` default singleton, which reads `ANTHROPIC_BASE_URL`
 * from the environment. That env var is set by the Claude Code/Desktop host
 * process this app is developed under (to "https://api.anthropic.com",
 * missing "/v1") and leaks into any child process — including `next dev`.
 * Explicitly pinning baseURL here makes every call immune to that, no
 * matter what shell environment the server happens to be launched from.
 */
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: "https://api.anthropic.com/v1",
});

// Aesthetic-judgment calls (color generation) — accuracy justifies the
// higher cost; this product is aimed at designers with a trained eye.
export const STRONG_MODEL = "claude-sonnet-4-6";

// Classification/extraction calls (freeform ingestion) — doesn't need
// the same reasoning depth, so the cheaper tier applies.
export const FAST_MODEL = "claude-haiku-4-5-20251001";

export function strongModel() {
  return anthropic(STRONG_MODEL);
}

export function fastModel() {
  return anthropic(FAST_MODEL);
}
