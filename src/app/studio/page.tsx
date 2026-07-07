import type { Metadata } from "next";
import { ThemeStudio } from "@/components/studio/theme-studio";

export const metadata: Metadata = {
  title: "Theme Studio — ToknHost",
  description: "Design your theme once. Use it everywhere.",
};

export default function StudioPage() {
  // h-svh + overflow-hidden pins the workspace to the viewport so only the
  // inner panes scroll, never the page itself.
  return (
    <div className="h-svh overflow-hidden">
      <ThemeStudio />
    </div>
  );
}
