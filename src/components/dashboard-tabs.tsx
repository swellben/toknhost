"use client";

import { useState } from "react";

const TAB_DEFS = [
  { id: "details",    label: "Details" },
  { id: "colors",     label: "Colors" },
  { id: "primitives", label: "Primitives" },
  { id: "tokens",     label: "Tokens" },
  { id: "typography", label: "Typography" },
  { id: "ux-patterns", label: "UX Patterns", comingSoon: true },
  { id: "copy",       label: "Copy",          comingSoon: true },
] as const;

type TabId = (typeof TAB_DEFS)[number]["id"];

export function DashboardTabs({
  initialTab,
  designSystemId,
  details,
  colors,
  primitives,
  tokens,
  typography,
}: {
  initialTab: TabId;
  designSystemId: string;
  details: React.ReactNode;
  colors: React.ReactNode;
  primitives: React.ReactNode;
  tokens: React.ReactNode;
  typography: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const content: Record<string, React.ReactNode> = {
    details, colors, primitives, tokens, typography,
  };

  return (
    <>
      <div className="flex gap-1 border-b">
        {TAB_DEFS.map((t) =>
          "comingSoon" in t ? (
            <span
              key={t.id}
              className="px-3 py-2 text-sm text-muted-foreground/50"
              title="Coming soon"
            >
              {t.label}
            </span>
          ) : (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as TabId)}
              className={`border-b-2 px-3 py-2 text-sm transition-colors ${
                activeTab === t.id
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          )
        )}
      </div>

      {Object.entries(content).map(([id, node]) => (
        <div key={id} className="flex-1 overflow-y-auto" hidden={activeTab !== id}>
          {node}
        </div>
      ))}
    </>
  );
}
