import { contrastRatio } from "@/lib/gap-fill/oklch";

export interface ContrastCheck {
  contrastRatio: number;
  passesAaNormal: boolean; // >= 4.5:1
  passesAaLarge: boolean; // >= 3:1
  passesAaaNormal: boolean; // >= 7:1
  passesAaaLarge: boolean; // >= 4.5:1
}

/**
 * WCAG 2 contrast check between a foreground and background color.
 * See CLAUDE.md "Accessibility Check Logic" — deterministic math, run
 * after gap-fill, never at query time.
 */
export function checkContrast(foregroundHex: string, backgroundHex: string): ContrastCheck {
  const ratio = contrastRatio(foregroundHex, backgroundHex);
  return {
    contrastRatio: ratio,
    passesAaNormal: ratio >= 4.5,
    passesAaLarge: ratio >= 3,
    passesAaaNormal: ratio >= 7,
    passesAaaLarge: ratio >= 4.5,
  };
}
