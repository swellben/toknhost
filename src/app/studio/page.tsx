import type { Metadata } from "next";
import { ThemeStudio } from "@/components/studio/theme-studio";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/plan";

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

  // Entitlements drive the free/premium affordances in the editor (export lock,
  // design-system cap). The server actions re-check server-side; this is just
  // for the UI. See FREEMIUM-GATING-PLAN.md.
  const entitlements = await getEntitlements();

  // h-svh + overflow-hidden pins the workspace to the viewport so only the
  // inner panes scroll, never the page itself.
  return (
    <div className="h-svh overflow-hidden">
      <ThemeStudio userEmail={userEmail} entitlements={entitlements} />
    </div>
  );
}
