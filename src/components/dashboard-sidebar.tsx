"use client";

import Link from "next/link";
import { Layers } from "lucide-react";
import { usePathname } from "next/navigation";
import { UpgradePromo } from "@/components/upgrade-promo";

interface DesignSystemSummary {
  id: string;
  name: string;
}

export function DashboardSidebar({
  designSystems,
}: {
  designSystems: DesignSystemSummary[];
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col justify-between border-r bg-sidebar p-4">
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        <Link
          href="/dashboard"
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
            pathname === "/dashboard" ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="size-4 shrink-0" />
          Design Systems
        </Link>

        <div className="ml-2 flex flex-col gap-0.5 border-l pl-3">
          {designSystems.length === 0 ? (
            <span className="px-2 py-1 text-xs text-muted-foreground">None yet</span>
          ) : (
            designSystems.map((ds) => {
              // No icon here on purpose — sub-nav items under "Design
              // Systems" are indented + icon-less to read as belonging
              // to the parent item, not as peer top-level destinations.
              const isActive = pathname === `/dashboard/${ds.id}`;
              return (
                <Link
                  key={ds.id}
                  href={`/dashboard/${ds.id}`}
                  className={`truncate rounded-md px-2 py-1 text-sm ${
                    isActive ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={ds.name}
                >
                  {ds.name}
                </Link>
              );
            })
          )}
        </div>
      </div>

      <UpgradePromo />
    </aside>
  );
}
