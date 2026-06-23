// Purely informational for now — there's no billing/upgrade flow built
// yet, so this links nowhere functional. It exists to set the
// expectation that export and the MCP server are the premium hook,
// ahead of actually building a paywall.
export function UpgradePromo() {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <p className="text-sm font-medium">Unlock export & MCP</p>
      <p className="text-xs text-muted-foreground">
        Upgrade to export tokens to any framework and connect AI coding
        agents via the live MCP server.
      </p>
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-60"
        title="Coming soon"
      >
        Upgrade (coming soon)
      </button>
    </div>
  );
}
