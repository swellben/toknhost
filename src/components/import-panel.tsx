"use client";

import { useState } from "react";
import { QuickStartForm } from "@/components/quick-start-form";
import { ImportTokensForm } from "@/components/import-tokens-form";

const TABS = [
  { id: "quick-start", label: "Quick start" },
  { id: "paste", label: "Paste a token file" },
] as const;

export function ImportPanel({
  designSystemId,
  currentPrimaryHex,
  currentSecondaryHex,
  currentFontName,
  currentRadius,
}: {
  designSystemId: string;
  currentPrimaryHex: string | null;
  currentSecondaryHex: string | null;
  currentFontName: string | null;
  currentRadius: string | null;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("quick-start");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-md bg-muted p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-sm px-3 py-1 text-sm ${
              tab === t.id ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "quick-start" ? (
        <QuickStartForm
          designSystemId={designSystemId}
          currentPrimaryHex={currentPrimaryHex}
          currentSecondaryHex={currentSecondaryHex}
          currentFontName={currentFontName}
          currentRadius={currentRadius}
        />
      ) : (
        <ImportTokensForm designSystemId={designSystemId} />
      )}
    </div>
  );
}
