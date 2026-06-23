// Uses theme tokens (primary/accent/muted from globals.css) instead of
// hardcoded Tailwind palette colors, so this follows the app's color
// scheme automatically rather than carrying its own.
const STYLES: Record<string, string> = {
  imported: "bg-primary/15 text-primary",
  derived: "bg-accent text-accent-foreground",
  defaulted: "bg-muted text-muted-foreground",
};

export function ProvenanceBadge({ provenance }: { provenance: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        STYLES[provenance] ?? STYLES.defaulted
      }`}
    >
      {provenance}
    </span>
  );
}
