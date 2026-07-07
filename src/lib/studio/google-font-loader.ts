"use client";

import { googleFontsUrl, fontFallback } from "@/lib/google-fonts";

/**
 * Lazily inject a Google Fonts stylesheet <link> for one family, once.
 * Cached by family via the element id, so re-selecting is free and we never
 * load more than the fonts the user actually picks (see PIVOT-PLAN — the perf
 * concern is loading files, not listing names). `display=swap` avoids FOIT.
 */
export function loadGoogleFont(name: string): void {
  if (typeof document === "undefined" || !name) return;
  const id = `gf-${name.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = googleFontsUrl(name);
  document.head.appendChild(link);
}

/** CSS font-family stack for a Google family, with a category-accurate fallback. */
export function googleFontStack(name: string): string {
  return `"${name}", ${fontFallback(name)}`;
}

/** Generic font-family stack for a custom/unknown family. */
export function customFontStack(family: string): string {
  return `"${family}", ui-sans-serif, system-ui, sans-serif`;
}

/** Inject a stylesheet <link> (e.g. a hosted @font-face CSS), cached by href. */
export function loadStylesheet(href: string): void {
  if (typeof document === "undefined" || !href) return;
  const id = `sheet-${hash(href)}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/** Inject an @font-face for a font-file URL (or uploaded object URL), cached. */
export function loadFontFace(family: string, src: string): void {
  if (typeof document === "undefined" || !family || !src) return;
  const id = `face-${hash(family + src)}`;
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `@font-face { font-family: "${family}"; src: url("${src}"); font-display: swap; }`;
  document.head.appendChild(style);
}

/** Load whatever a CustomFont describes so the preview can render it. */
export function loadCustomFont(cf: {
  family: string;
  src: string;
  kind: "stylesheet" | "fontfile";
}): void {
  if (!cf.src || !cf.family) return;
  if (cf.kind === "stylesheet") loadStylesheet(cf.src);
  else loadFontFace(cf.family, cf.src);
}

/** Guess whether a pasted URL is a stylesheet vs a raw font file. */
export function isStylesheetUrl(url: string): boolean {
  return /\.css(\?|$)|css2\?|\/css\b/i.test(url);
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
