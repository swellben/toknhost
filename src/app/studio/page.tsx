import type { Metadata } from "next";
import { ThemeStudio } from "@/components/studio/theme-studio";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Theme Studio — ToknHost",
  description: "Design your theme once. Use it everywhere.",
};

export default async function StudioPage() {
  // /studio is publicly accessible, so a visitor may be signed out — in that
  // case there's no email and the studio simply renders without a user menu.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userEmail = data?.claims?.email as string | undefined;

  // h-svh + overflow-hidden pins the workspace to the viewport so only the
  // inner panes scroll, never the page itself.
  return (
    <div className="h-svh overflow-hidden">
      <ThemeStudio userEmail={userEmail} />
    </div>
  );
}
