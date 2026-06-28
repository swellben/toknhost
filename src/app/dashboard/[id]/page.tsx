import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImportPanel } from "@/components/import-panel";
import { GapFillButton } from "@/components/gap-fill-button";
import { A11yCheckButton } from "@/components/a11y-check-button";
import { EditableTokenRow } from "@/components/editable-token-row";
import { EditDesignSystemForm } from "@/components/edit-design-system-form";
import { McpAccessCard } from "@/components/mcp-access-card";
import { TypographyCard } from "@/components/typography-card";
import { formatTokenValue } from "@/lib/format-token-value";
import { classifyToken } from "@/lib/token-classification";
import { fetchPreviewTheme } from "@/lib/mcp-client";
import { DesignSystemPreviewPanel } from "@/components/design-system-preview-panel";
import { ThemeProvider } from "@/components/theme-context";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const VALID_TABS = new Set(["details", "colors", "primitives", "tokens", "typography"]);
type TabId = "details" | "colors" | "primitives" | "tokens" | "typography";

export default async function DesignSystemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { mode: requestedMode, tab: requestedTab } = await searchParams;
  const initialTab: TabId = VALID_TABS.has(requestedTab ?? "") ? (requestedTab as TabId) : "details";

  const supabase = await createClient();

  // Batch 1: parallel — all only need `id` from params
  const [{ data: designSystem }, { data: modes }, { data: tokens }] = await Promise.all([
    supabase
      .from("design_systems")
      .select("id, name, slug, description, is_public, target_framework, mcp_token")
      .eq("id", id)
      .single(),
    supabase
      .from("modes")
      .select("id, name, is_default")
      .eq("design_system_id", id)
      .order("sort_order"),
    supabase
      .from("tokens")
      .select("id, path, category, type, provenance")
      .eq("design_system_id", id)
      .order("path"),
  ]);

  if (!designSystem) notFound();
  const ds = designSystem;

  const activeMode =
    modes?.find((m) => m.name === requestedMode) ??
    modes?.find((m) => m.is_default) ??
    modes?.[0];

  const allModeIds = (modes ?? []).map((m) => m.id);
  const tokenIds = (tokens ?? []).map((t) => t.id);

  // Batch 2: parallel — values, all-mode values, a11y, and both preview
  // fetches (css-variables + shadcn, for the framework-authentic preview)
  // all at once.
  const [{ data: values }, { data: allValues }, { data: a11yChecks }, previewTheme, previewThemeShadcn] =
    await Promise.all([
      activeMode && tokenIds.length
        ? supabase
            .from("token_values")
            .select("token_id, value, is_alias, alias_path")
            .eq("mode_id", activeMode.id)
            .in("token_id", tokenIds)
        : Promise.resolve({ data: [] as { token_id: string; value: unknown; is_alias: boolean; alias_path: string | null }[] }),
      allModeIds.length && tokenIds.length
        ? supabase
            .from("token_values")
            .select("token_id, value, is_alias, alias_path, mode_id, raw_value")
            .in("mode_id", allModeIds)
            .in("token_id", tokenIds)
        : Promise.resolve({ data: [] as { token_id: string; value: unknown; is_alias: boolean; alias_path: string | null; mode_id: string; raw_value: string | null }[] }),
      supabase
        .from("accessibility_checks")
        .select(
          "contrast_ratio, passes_aa_normal, passes_aa_large, passes_aaa_normal, foreground:tokens!accessibility_checks_foreground_token_id_fkey(path), background:tokens!accessibility_checks_background_token_id_fkey(path), modes(name)",
        )
        .eq("design_system_id", id)
        .order("contrast_ratio"),
      tokens?.length
        ? fetchPreviewTheme(ds.slug, ds.mcp_token, ds.is_public)
        : Promise.resolve(null),
      tokens?.length
        ? fetchPreviewTheme(ds.slug, ds.mcp_token, ds.is_public, "shadcn")
        : Promise.resolve(null),
    ]);

  const valueByTokenId = new Map((values ?? []).map((v) => [v.token_id, v]));

  const valuesByMode = new Map<string, Map<string, { value: unknown; is_alias: boolean; alias_path: string | null }>>();
  for (const v of allValues ?? []) {
    if (!valuesByMode.has(v.mode_id)) valuesByMode.set(v.mode_id, new Map());
    valuesByMode.get(v.mode_id)!.set(v.token_id, v);
  }

  // Derived token metadata
  function hexOfValue(v: unknown): string | null {
    if (v && typeof v === "object" && "hex" in v) return String((v as { hex: unknown }).hex);
    return null;
  }

  const fontFamilyToken = tokens?.find((t) => t.path === "font-family.base");
  const fontFamilyValue = fontFamilyToken
    ? (valueByTokenId.get(fontFamilyToken.id)?.value as { primary?: string } | undefined)
    : undefined;
  const baseSizeToken = tokens?.find((t) => t.path === "font-size.base");
  const baseSizeValue = baseSizeToken
    ? (valueByTokenId.get(baseSizeToken.id)?.value as { value?: number } | undefined)
    : undefined;

  const primaryToken = tokens?.find((t) => t.path === "color.primary");
  const currentPrimaryHex = primaryToken ? hexOfValue(valueByTokenId.get(primaryToken.id)?.value) : null;
  const secondaryToken = tokens?.find((t) => t.path === "color.secondary");
  const currentSecondaryHex = secondaryToken ? hexOfValue(valueByTokenId.get(secondaryToken.id)?.value) : null;
  const radiusToken = tokens?.find((t) => t.path === "border-radius.base");
  const radiusValue = allValues?.find(
    (v) => v.token_id === radiusToken?.id && v.mode_id === activeMode?.id
  );
  const currentRadius = (radiusValue?.raw_value as string | undefined) ?? null;
  const currentQuickStartFont =
    (valueByTokenId.get(fontFamilyToken?.id ?? "")?.value as { primary?: string } | undefined)?.primary ?? null;

  // Token buckets
  const typographyTokens: typeof tokens = [];
  const primitiveTokens: typeof tokens = [];
  const colorTokens: typeof tokens = [];
  const semanticTokens: typeof tokens = [];

  for (const t of tokens ?? []) {
    const bucket = classifyToken(t.category, t.path);
    if (bucket === "typography") typographyTokens.push(t);
    else if (bucket === "primitives") primitiveTokens.push(t);
    else if (bucket === "colors") colorTokens.push(t);
    else semanticTokens.push(t);
  }

  // Helpers
  function groupByCategory(list: typeof tokens) {
    const grouped = new Map<string, typeof tokens>();
    for (const t of list ?? []) {
      const group = grouped.get(t.category) ?? [];
      group.push(t);
      grouped.set(t.category, group);
    }
    return grouped;
  }

  function sortByPath(a: { path: string }, b: { path: string }): number {
    const aParts = a.path.split(".");
    const bParts = b.path.split(".");
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const as = aParts[i] ?? "";
      const bs = bParts[i] ?? "";
      const an = parseInt(as, 10);
      const bn = parseInt(bs, 10);
      if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
      const cmp = as.localeCompare(bs);
      if (cmp !== 0) return cmp;
    }
    return 0;
  }

  const modeSwitcher = modes && modes.length > 1 && (
    <div className="flex gap-1 rounded-md bg-muted p-1">
      {modes.map((m) => (
        <Link
          key={m.id}
          href={`/dashboard/${id}?tab=tokens&mode=${m.name}`}
          className={`rounded-sm px-3 py-1 text-sm capitalize ${
            activeMode?.id === m.id
              ? "bg-background font-medium shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          {m.name}
        </Link>
      ))}
    </div>
  );

  function colorTable(list: typeof tokens) {
    if (!list?.length) {
      return (
        <p className="text-sm text-muted-foreground">
          No color tokens yet — import tokens or run gap-fill from the Details tab.
        </p>
      );
    }
    const lightMode = modes?.find((m) => m.is_default) ?? modes?.[0];
    const darkMode = modes?.find((m) => !m.is_default && m.name !== lightMode?.name);
    const lightVals = lightMode ? (valuesByMode.get(lightMode.id) ?? new Map()) : new Map();
    const darkVals = darkMode ? (valuesByMode.get(darkMode.id) ?? new Map()) : new Map();

    return (
      <div className="flex flex-col gap-6">
        {[...groupByCategory(list).entries()].map(([category, categoryTokens]) => (
          <div key={category} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold capitalize text-muted-foreground">
              {category} ({categoryTokens!.length})
            </h3>
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col />
                <col className="w-36" />
                {darkMode && <col className="w-36" />}
              </colgroup>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-1">Token</th>
                  <th className="pb-1 capitalize">{lightMode?.name ?? "Light"}</th>
                  {darkMode && <th className="pb-1 capitalize">{darkMode.name}</th>}
                </tr>
              </thead>
              <tbody>
                {[...categoryTokens!].sort(sortByPath).map((t) => {
                  const lv = lightVals.get(t.id);
                  const dv = darkVals.get(t.id);
                  const lFormatted = lv?.is_alias
                    ? { display: `→ ${lv.alias_path}`, swatch: undefined }
                    : formatTokenValue(t.type, lv?.value);
                  const dFormatted = dv?.is_alias
                    ? { display: `→ ${dv.alias_path}`, swatch: undefined }
                    : formatTokenValue(t.type, dv?.value);
                  return (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono">{t.path}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          {lFormatted.swatch && (
                            <span className="inline-block h-5 w-5 shrink-0 rounded border" style={{ backgroundColor: lFormatted.swatch }} />
                          )}
                          <span className="font-mono text-xs text-muted-foreground truncate">{lFormatted.display}</span>
                        </div>
                      </td>
                      {darkMode && (
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            {dFormatted.swatch && (
                              <span className="inline-block h-5 w-5 shrink-0 rounded border" style={{ backgroundColor: dFormatted.swatch }} />
                            )}
                            <span className="font-mono text-xs text-muted-foreground truncate">{dFormatted.display}</span>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }

  function tokenTable(list: typeof tokens, emptyMessage: string, deletable = true) {
    if (!list?.length) {
      return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
    }
    return (
      <div className="flex flex-col gap-6">
        {[...groupByCategory(list).entries()].map(([category, categoryTokens]) => (
          <div key={category} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold capitalize text-muted-foreground">
              {category} ({categoryTokens!.length})
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {[...categoryTokens!].sort(sortByPath).map((t) => {
                  const tv = valueByTokenId.get(t.id);
                  const isAlias = Boolean(tv?.is_alias);
                  const formatted = isAlias
                    ? { display: `→ ${tv?.alias_path}` }
                    : formatTokenValue(t.type, tv?.value);
                  return (
                    <EditableTokenRow
                      key={t.id}
                      designSystemId={ds.id}
                      modeId={activeMode!.id}
                      modeName={activeMode!.name}
                      tokenId={t.id}
                      path={t.path}
                      type={t.type}
                      provenance={t.provenance}
                      display={formatted.display}
                      swatch={formatted.swatch}
                      isAlias={isAlias}
                      deletable={deletable}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }

  // Tab content — all rendered server-side, client switches between them instantly
  const detailsContent = (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
        <CardContent>
          <EditDesignSystemForm
            key={`${ds.name}-${ds.description}-${ds.is_public}-${ds.target_framework}`}
            designSystemId={ds.id}
            name={ds.name}
            description={ds.description}
            isPublic={ds.is_public}
            targetFramework={ds.target_framework}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Import tokens</CardTitle></CardHeader>
        <CardContent>
          <ImportPanel
            designSystemId={ds.id}
            currentPrimaryHex={currentPrimaryHex}
            currentSecondaryHex={currentSecondaryHex}
            currentFontName={currentQuickStartFont}
            currentRadius={currentRadius}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Gap-fill</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Derives full color scales using AI for an aesthetically refined palette,
            plus dark mode, accessible foregrounds, and missing typography/spacing
            defaults (algorithmic). Automatically validates and corrects contrast
            after running.
          </p>
          <GapFillButton designSystemId={ds.id} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Accessibility</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            WCAG contrast checks for every foreground/background pair, per mode.
            Runs automatically after gap-fill; click to re-check after manual token edits.
          </p>
          <A11yCheckButton designSystemId={ds.id} />
          {a11yChecks && a11yChecks.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Mode</th>
                  <th className="py-2 pr-4">Foreground</th>
                  <th className="py-2 pr-4">Background</th>
                  <th className="py-2 pr-4">Pattern</th>
                  <th className="py-2 pr-4">Ratio</th>
                  <th className="py-2">AA</th>
                </tr>
              </thead>
              <tbody>
                {a11yChecks.map((c, i) => {
                  const fgPath = c.foreground?.path ?? "";
                  const bgPath = c.background?.path ?? "";
                  const isAlert = ["color.warning","color.success","color.danger","color.info"].includes(fgPath) && bgPath === "color.background";
                  const patternLabel = isAlert ? "alert text on tinted bg" : "component foreground on fill";
                  return (
                    <tr key={i} className={`border-b last:border-0 ${!c.passes_aa_normal ? "bg-destructive/5" : ""}`}>
                      <td className="py-2 pr-4">{c.modes?.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{fgPath}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{bgPath}{isAlert ? <span className="ml-1 text-muted-foreground">(12% tint)</span> : null}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{patternLabel}</td>
                      <td className="py-2 pr-4">{c.contrast_ratio}</td>
                      <td className="py-2">
                        {c.passes_aa_normal
                          ? <span className="text-success">pass</span>
                          : <span className="font-medium text-destructive">fail</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>MCP server</CardTitle></CardHeader>
        <CardContent>
          <McpAccessCard
            designSystemId={ds.id}
            endpointUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/design-system-mcp/${ds.slug}`}
            isPublic={ds.is_public}
            mcpToken={ds.mcp_token}
            defaultFramework={ds.target_framework}
            modeNames={(modes ?? []).map((m) => m.name)}
          />
        </CardContent>
      </Card>
    </div>
  );

  const colorsContent = (
    <Card>
      <CardHeader><CardTitle>Colors ({colorTokens.length})</CardTitle></CardHeader>
      <CardContent>{colorTable(colorTokens)}</CardContent>
    </Card>
  );

  const primitivesContent = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Primitives ({primitiveTokens.length})</CardTitle>
        {modeSwitcher}
      </CardHeader>
      <CardContent>
        {tokenTable(primitiveTokens, "No primitives yet — import tokens or run gap-fill from the Details tab.")}
      </CardContent>
    </Card>
  );

  const tokensContent = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tokens ({semanticTokens.length})</CardTitle>
        {modeSwitcher}
      </CardHeader>
      <CardContent>
        {tokenTable(semanticTokens, "No semantic tokens yet — import tokens or run gap-fill from the Details tab.")}
      </CardContent>
    </Card>
  );

  const typographyContent = (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader><CardTitle>Typography</CardTitle></CardHeader>
        <CardContent>
          <TypographyCard
            key={`${fontFamilyValue?.primary}-${baseSizeValue?.value}`}
            designSystemId={ds.id}
            currentFontName={fontFamilyValue?.primary ?? null}
            currentBaseSize={baseSizeValue?.value ?? null}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Typography tokens ({typographyTokens.length})</CardTitle>
          {modeSwitcher}
        </CardHeader>
        <CardContent>
          {tokenTable(typographyTokens, "No typography tokens yet — set a font or generate a scale above.")}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{ds.name}</h1>
        <p className="text-sm text-muted-foreground">/{ds.slug}</p>
      </div>

      <ThemeProvider initialByMode={previewTheme}>
        {/* DashboardTabs owns the tab bar and switches content client-side — no server round-trip on tab change */}
        <div className="flex flex-1 gap-6 overflow-hidden">
          <div className="min-w-0 flex-1 flex flex-col min-h-0">
            <DashboardTabs
              initialTab={initialTab}
              designSystemId={ds.id}
              details={detailsContent}
              colors={colorsContent}
              primitives={primitivesContent}
              tokens={tokensContent}
              typography={typographyContent}
            />
          </div>
          <div className="w-1/2 shrink-0 overflow-y-auto border-l pl-6">
            <DesignSystemPreviewPanel
              defaultMode={modes?.find((m) => m.is_default)?.name ?? "light"}
              shadcnByMode={previewThemeShadcn}
            />
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
}
