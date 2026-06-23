import { computeGapFill } from "./src/lib/gap-fill/index";
import { materialDarkInvert, ctaDarkPair } from "./src/lib/gap-fill/material";
import { hexToOklch, toOklchString } from "./src/lib/gap-fill/oklch";

function colorValue(hex: string) {
  const { l, c, h } = hexToOklch(hex);
  return { hex, oklch: toOklchString(l, c, h), space: "oklch" };
}

// Simulates exactly what Quick Start writes, then what runGapFill does.
const existing = [
  { id: "primary", path: "color.primary", category: "color", type: "color", value: { hex: "#1e6fd9", oklch: "", space: "oklch" } },
  { id: "secondary", path: "color.secondary", category: "color", type: "color", value: { hex: "#e8702a", oklch: "", space: "oklch" } },
  { id: "radius", path: "border-radius.base", category: "border-radius", type: "dimension", value: { value: 12, unit: "px" } },
  { id: "font", path: "font-family.base", category: "font-family", type: "fontFamily", value: { primary: "Poppins", stack: ["Poppins", "sans-serif"] } },
];

const derived = computeGapFill(existing as any);

// Build full light-mode token set: existing + derived
const allLight = [...existing, ...derived.map((d) => ({ id: d.path, path: d.path, category: d.category, type: d.type, value: d.value }))];

// Dark mode: only color category, mirroring runGapFill's CTA-pair logic for primary/secondary.
const ctaPairs = new Map<string, ReturnType<typeof ctaDarkPair>>();
for (const t of allLight) {
  if (t.path === "color.primary" || t.path === "color.secondary") {
    const hex = (t.value as { hex: string }).hex;
    ctaPairs.set(t.path, ctaDarkPair(hex));
  }
}
const darkRows: { path: string; value: unknown }[] = [];
for (const t of allLight) {
  if (t.category !== "color" || t.type !== "color") continue;
  const hex = (t.value as { hex: string }).hex;
  if (t.path === "color.primary" || t.path === "color.secondary") {
    darkRows.push({ path: t.path, value: ctaPairs.get(t.path)!.container });
  } else if (t.path === "color.primary.foreground" || t.path === "color.secondary.foreground") {
    const basePath = t.path.replace(".foreground", "");
    darkRows.push({ path: t.path, value: ctaPairs.get(basePath)?.foreground ?? colorValue(materialDarkInvert(hex)) });
  } else {
    darkRows.push({ path: t.path, value: colorValue(materialDarkInvert(hex)) });
  }
}

console.log("=== TOKENS SQL ===");
const tokenValues = allLight.map((t) =>
  `('${t.path.replace(/'/g, "''")}', '${t.category}', '${t.type}')`
);
console.log(`-- ${allLight.length} tokens, ${new Set(allLight.map(t=>t.category)).size} categories`);

console.log("=== LIGHT VALUES JSON ===");
console.log(JSON.stringify(allLight.map((t) => ({ path: t.path, value: t.value }))));

console.log("=== DARK VALUES JSON ===");
console.log(JSON.stringify(darkRows));
