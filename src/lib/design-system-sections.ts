// Single source of truth for the per-design-system sub-nav — used by the
// sidebar (to render links) and the [id]/[section] page (to validate the
// route param and pick which content to render). Order here is render order.
export const DESIGN_SYSTEM_SECTIONS = [
  { id: "details", label: "Details" },
  { id: "colors", label: "Colors" },
  { id: "primitives", label: "Primitives" },
  { id: "tokens", label: "Tokens" },
  { id: "typography", label: "Typography" },
  { id: "accessibility", label: "Accessibility" },
  { id: "ux-patterns", label: "UX Patterns", comingSoon: true },
  { id: "copy", label: "Copy", comingSoon: true },
] as const;

export type DesignSystemSection = (typeof DESIGN_SYSTEM_SECTIONS)[number]["id"];

export const VALID_DESIGN_SYSTEM_SECTIONS = new Set<string>(
  DESIGN_SYSTEM_SECTIONS.map((s) => s.id)
);
