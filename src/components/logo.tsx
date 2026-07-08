import { cn } from "@/lib/utils";

/** The ToknHost mark — a self-contained tile logo (grey glyph on #272727).
 * Inlined so it needs no network request and rounds cleanly at any size. Also
 * lives at src/app/icon.svg (the favicon) and public/logo.svg (raw asset). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 163 163"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ToknHost"
      className={cn("overflow-hidden rounded-md", className)}
    >
      <rect width="163" height="163" fill="#272727" />
      <path
        d="M113.381 97.5908V137.409C105.474 141.563 96.6277 144.17 87.2441 144.831V97.5908H113.381ZM140.632 46.1816C145.962 55.7495 149 66.77 149 78.5C149 94.9531 143.024 110.01 133.125 121.62V53.2725H113.381V81.6816H87.2441V53.2725H67.5V143.301C64.9521 142.713 62.4608 141.978 60.0342 141.107V46.1816H140.632ZM40.5742 46.1816V130.119C25.5803 117.926 16 99.3323 16 78.5C16 66.77 19.0375 55.7495 24.3682 46.1816H40.5742ZM82.5 12C100.242 12 116.361 18.9487 128.285 30.2725H36.7148C48.6388 18.9487 64.7578 12 82.5 12Z"
        fill="#575757"
      />
    </svg>
  );
}
