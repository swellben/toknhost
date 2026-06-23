import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { TopNav } from "@/components/top-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const email = data.claims.email as string | undefined;

  const { data: designSystems } = await supabase
    .from("design_systems")
    .select("id, name")
    .order("created_at", { ascending: false });

  return (
    // h-svh + overflow-hidden (not min-h-svh) pins this column to exactly
    // the viewport height so the page itself never scrolls — only
    // <main>'s own overflow-y-auto does.
    <div className="flex h-svh flex-col overflow-hidden">
      <TopNav email={email ?? ""} />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar designSystems={designSystems ?? []} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
