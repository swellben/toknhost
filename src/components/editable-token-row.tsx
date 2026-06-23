"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateTokenValue, deleteToken } from "@/app/dashboard/[id]/token-actions";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { useTheme } from "@/components/theme-context";
import type { TokenType } from "@/types/tokens";

// Composite types can't be represented as a single text field — editing
// those is a future "structured" editor, not this one.
const EDITABLE_TYPES: TokenType[] = ["color", "dimension", "fontWeight", "number", "string", "boolean"];

export function EditableTokenRow({
  designSystemId,
  modeId,
  modeName,
  tokenId,
  path,
  type,
  provenance,
  display,
  swatch,
  isAlias,
  deletable,
}: {
  designSystemId: string;
  modeId: string;
  modeName: string;
  tokenId: string;
  path: string;
  type: string;
  provenance: string;
  display: string;
  swatch?: string;
  isAlias: boolean;
  deletable?: boolean;
}) {
  const router = useRouter();
  const { applyOptimistic } = useTheme();
  // Tracks the latest color picker value so onBlur saves the final hex
  // rather than re-reading a potentially stale closure.
  const pendingColorRef = useRef<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editable = !isAlias && EDITABLE_TYPES.includes(type as TokenType);
  const canDelete = deletable !== false;

  function save(rawValue: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateTokenValue(
        designSystemId,
        tokenId,
        modeId,
        type as TokenType,
        rawValue
      );
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${path}"? This removes it from every mode.`)) return;
    startTransition(async () => {
      const result = await deleteToken(designSystemId, tokenId);
      if (result && "error" in result) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <tr className="border-b last:border-0">
      <td className="w-8 py-2">
        {swatch &&
          (editable ? (
            <input
              type="color"
              defaultValue={swatch}
              disabled={pending}
              onChange={(e) => {
                // Instant preview feedback — no server round-trip yet.
                const cssVar = `--${path.replaceAll(".", "-")}`;
                applyOptimistic(modeName, cssVar, e.target.value);
                pendingColorRef.current = e.target.value;
              }}
              onBlur={() => {
                // Persist once the user closes the picker.
                if (pendingColorRef.current !== null) {
                  save(pendingColorRef.current);
                  pendingColorRef.current = null;
                }
              }}
              aria-label={`Edit ${path} color`}
              className="h-5 w-5 cursor-pointer rounded border disabled:cursor-not-allowed"
            />
          ) : (
            <span
              className="inline-block h-5 w-5 rounded border"
              style={{ backgroundColor: swatch }}
            />
          ))}
      </td>
      <td className="py-2 pr-4 font-mono">{path}</td>
      <td className="py-2 pr-4 font-mono text-muted-foreground">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => save(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save(draft);
              if (e.key === "Escape") {
                setDraft(display);
                setEditing(false);
              }
            }}
            disabled={pending}
            className="w-full rounded border bg-transparent px-1 font-mono text-sm"
          />
        ) : (
          <button
            type="button"
            disabled={!editable || type === "color" || pending}
            onClick={() => setEditing(true)}
            title={editable && type !== "color" ? "Click to edit" : undefined}
            className={
              editable && type !== "color"
                ? "cursor-text rounded border-b border-dashed border-muted-foreground/50 hover:border-foreground hover:text-foreground"
                : ""
            }
          >
            {display}
          </button>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </td>
      <td className="py-2">
        <ProvenanceBadge provenance={provenance} />
      </td>
      {canDelete && (
        <td className="w-8 py-2 text-right">
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-xs text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${path}`}
          >
            ✕
          </button>
        </td>
      )}
    </tr>
  );
}
