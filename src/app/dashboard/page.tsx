import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateDesignSystemForm } from "@/components/create-design-system-form";
import { DeleteDesignSystemButton } from "@/components/delete-design-system-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: designSystems } = await supabase
    .from("design_systems")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  const ids = (designSystems ?? []).map((ds) => ds.id);
  const { data: tokenCounts } = ids.length
    ? await supabase.from("tokens").select("design_system_id").in("design_system_id", ids)
    : { data: [] };

  const countByDesignSystem = new Map<string, number>();
  for (const t of tokenCounts ?? []) {
    countByDesignSystem.set(
      t.design_system_id,
      (countByDesignSystem.get(t.design_system_id) ?? 0) + 1
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Design Systems</h1>
        <CreateDesignSystemForm />
      </div>

      {!designSystems?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No design systems yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Create one above, then import your first set of design tokens.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {designSystems.map((ds) => (
            <Link key={ds.id} href={`/dashboard/${ds.id}`}>
              <Card className="relative transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle>{ds.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    /{ds.slug} · {countByDesignSystem.get(ds.id) ?? 0} tokens
                  </span>
                  <DeleteDesignSystemButton designSystemId={ds.id} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
