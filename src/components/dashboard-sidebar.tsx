"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UpgradePromo } from "@/components/upgrade-promo";
import { DESIGN_SYSTEM_SECTIONS } from "@/lib/design-system-sections";

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
  // Matches /dashboard/<id> or /dashboard/<id>/<section> — null on the
  // design-systems list, settings, or anywhere else outside a single DS.
  const match = /^\/dashboard\/([^/]+)(?:\/([^/]+))?$/.exec(pathname);
  const activeDesignSystemId = match && match[1] !== "settings" ? match[1] : null;
  const activeSection = match?.[2];

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col justify-between border-r bg-sidebar p-4">
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        {designSystems.length === 0 ? (
          <span className="px-2 py-1 text-xs text-muted-foreground">None yet</span>
        ) : (
          designSystems.map((ds) => {
            const isActiveDs = ds.id === activeDesignSystemId;
            return (
              <div key={ds.id} className="flex flex-col gap-0.5">
                <Link
                  href={`/dashboard/${ds.id}/details`}
                  className={`truncate rounded-md px-2 py-1.5 text-sm ${
                    isActiveDs ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={ds.name}
                >
                  {ds.name}
                </Link>
                {isActiveDs && (
                  <div className="ml-2 flex flex-col gap-0.5 border-l pl-3">
                    {DESIGN_SYSTEM_SECTIONS.map((s) => (
                      <Link
                        key={s.id}
                        href={`/dashboard/${ds.id}/${s.id}`}
                        className={`truncate rounded-md px-2 py-1 text-sm ${
                          activeSection === s.id
                            ? "bg-accent font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s.label}
                        {"comingSoon" in s && s.comingSoon ? (
                          <span className="ml-1 text-xs text-muted-foreground/50">(soon)</span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <UpgradePromo />
    </aside>
  );
}
