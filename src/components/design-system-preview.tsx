"use client";

import React, { type CSSProperties, useEffect } from "react";

function v(vars: Record<string, string>, name: string, fallback: string): string {
  return vars[name] || fallback;
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

/**
 * Renders a rich design system preview entirely from resolved CSS variables.
 * All styles are inline so this panel shows the IMPORTED system, not our app's
 * own Tailwind theme. Includes: nav, buttons, badges, form controls, toggles,
 * cards with progress, avatars, alerts, and a data table.
 */
export function DesignSystemPreview({ variables }: { variables: Record<string, string> | null }) {
  if (!variables || Object.keys(variables).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Import tokens and run gap-fill (Details tab) to see a live preview.
      </p>
    );
  }

  const bg       = v(variables, "--color-background",           "#ffffff");
  const fg       = v(variables, "--color-foreground",           "#111111");
  const primary  = v(variables, "--color-primary",              "#3b82f6");
  const primFg   = v(variables, "--color-primary-foreground",   "#ffffff");
  const secondary = v(variables, "--color-secondary",           "#6b7280");
  const secFg    = v(variables, "--color-secondary-foreground", "#ffffff");
  const muted    = v(variables, "--color-muted",                "#f3f4f6");
  const mutedFg  = v(variables, "--color-muted-foreground",     "#6b7280");
  const border   = v(variables, "--color-border",               "#e5e7eb");
  const danger   = v(variables, "--color-danger",               "#ef4444");
  const success  = v(variables, "--color-success",              "#22c55e");
  const warning  = v(variables, "--color-warning",              "#f59e0b");

  // Light tinted surfaces from scale steps (graceful fallback to muted)
  const primary100  = v(variables, "--color-primary-100",   muted);
  const secondary100 = v(variables, "--color-secondary-100", muted);

  const fontFamily = v(variables, "--font-family-base", "inherit");
  // Extract the first font name for Google Fonts loading (strip quotes, take before comma)
  const googleFontName = fontFamily
    .split(",")[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
  const isLoadable = googleFontName && googleFontName !== "inherit" && googleFontName !== "sans-serif" && googleFontName !== "serif" && googleFontName !== "monospace";
  const googleFontsUrl = isLoadable
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(googleFontName)}:wght@400;500;600;700&display=swap`
    : null;

  // Inject the font into <head> — @import inside a body <style> tag is
  // unreliable cross-browser. A <link> in <head> is the only guaranteed path.
  useEffect(() => {
    if (!googleFontsUrl) return;
    const id = `gf-preview-${encodeURIComponent(googleFontName)}`;
    if (document.getElementById(id)) return; // already loaded
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = googleFontsUrl;
    document.head.appendChild(link);
  }, [googleFontsUrl, googleFontName]);

  const radius     = v(variables, "--border-radius-base", "8px");
  const smRadius   = `calc(${radius} * 0.6)`;
  const fgRgb      = hexToRgb(fg.startsWith("#") && fg.length >= 7 ? fg : "#111111");

  const sm   = v(variables, "--font-size-sm",   "14px");
  const base = v(variables, "--font-size-base",  "16px");
  const lg   = v(variables, "--font-size-lg",    "18px");
  const xl   = v(variables, "--font-size-xl",    "20px");
  const xl2  = v(variables, "--font-size-2xl",   "24px");

  const wrap: CSSProperties = { backgroundColor: bg, color: fg, fontFamily };

  const btnBase: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: radius, fontFamily, fontSize: sm,
    fontWeight: 500, padding: "0.45rem 1rem", border: "none", cursor: "pointer",
    lineHeight: 1.4,
  };

  const badge = (bg2: string, color: string): CSSProperties => ({
    display: "inline-flex", alignItems: "center",
    padding: "0.15rem 0.55rem", borderRadius: "999px",
    fontSize: "12px", fontWeight: 600, backgroundColor: bg2, color,
    lineHeight: 1.4,
  });

  const inputStyle: CSSProperties = {
    width: "100%", padding: "0.45rem 0.75rem", borderRadius: radius,
    border: `1px solid ${border}`, backgroundColor: bg, color: fg,
    fontFamily, fontSize: sm, outline: "none",
  };

  const card: CSSProperties = {
    backgroundColor: muted, borderRadius: radius,
    border: `1px solid ${border}`, padding: "1.25rem",
  };

  const section: CSSProperties = {
    backgroundColor: bg, borderRadius: radius,
    border: `1px solid ${border}`, padding: "1.25rem",
  };

  const dividerStyle: CSSProperties = {
    borderTop: `1px solid ${border}`, margin: "1rem 0",
  };

  const alertStyle = (bgColor: string, textColor: string): CSSProperties => ({
    padding: "0.7rem 1rem", borderRadius: smRadius,
    backgroundColor: bgColor, color: textColor,
    fontSize: sm, lineHeight: 1.5,
  });

  const progressBar = (pct: number, color: string): React.ReactElement => (
    <div style={{ height: "6px", borderRadius: "999px", backgroundColor: border, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: "999px" }} />
    </div>
  );

  const avatar = (initials: string, bg2: string, color: string): React.ReactElement => (
    <div style={{
      width: "36px", height: "36px", borderRadius: "50%",
      backgroundColor: bg2, color, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: "13px", fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );

  const toggleStyle = (on: boolean): CSSProperties => ({
    display: "inline-flex", alignItems: "center",
    width: "40px", height: "22px", borderRadius: "999px",
    backgroundColor: on ? primary : border,
    padding: "2px", cursor: "pointer", flexShrink: 0,
    transition: "background-color 0.2s",
  });

  const toggleKnob = (on: boolean): CSSProperties => ({
    width: "18px", height: "18px", borderRadius: "50%",
    backgroundColor: "#ffffff",
    transform: on ? "translateX(18px)" : "translateX(0)",
    transition: "transform 0.2s",
    flexShrink: 0,
  });

  return (
    <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: "0", fontSize: base }}>

      {/* ── Nav bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 1.5rem", height: "58px",
        borderBottom: `1px solid ${border}`, backgroundColor: bg,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <span style={{ fontWeight: 700, fontSize: lg, color: primary }}>Acme</span>
          {["Dashboard", "Projects", "Team", "Settings"].map((label, i) => (
            <span key={label} style={{
              fontSize: sm, fontWeight: i === 0 ? 600 : 400,
              color: i === 0 ? fg : mutedFg,
              paddingBottom: i === 0 ? "2px" : "0",
              borderBottom: i === 0 ? `2px solid ${primary}` : "none",
              cursor: "pointer",
            }}>
              {label}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "50%",
            backgroundColor: primary, color: primFg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "13px", fontWeight: 700,
          }}>JD</div>
        </div>
      </div>

      <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* ── Row 1: Buttons + Badges ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

          {/* Buttons */}
          <div style={section}>
            <p style={{ margin: "0 0 1rem", fontSize: sm, fontWeight: 600, color: mutedFg, textTransform: "uppercase", letterSpacing: "0.05em" }}>Buttons</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
              <button style={{ ...btnBase, backgroundColor: primary, color: primFg }}>Primary</button>
              <button style={{ ...btnBase, backgroundColor: secondary, color: secFg }}>Secondary</button>
              <button style={{ ...btnBase, backgroundColor: "transparent", color: fg, border: `1px solid ${border}` }}>Outline</button>
              <button style={{ ...btnBase, backgroundColor: muted, color: mutedFg }}>Muted</button>
              <button style={{ ...btnBase, backgroundColor: danger, color: "#ffffff" }}>Destructive</button>
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
              <button style={{ ...btnBase, backgroundColor: primary, color: primFg, fontSize: "12px", padding: "0.3rem 0.75rem" }}>Small</button>
              <button style={{ ...btnBase, backgroundColor: "transparent", color: primary, border: `1px solid ${primary}` }}>Ghost</button>
              <button style={{ ...btnBase, backgroundColor: primary, color: primFg, opacity: 0.45, cursor: "not-allowed" }} disabled>Disabled</button>
            </div>
          </div>

          {/* Badges */}
          <div style={section}>
            <p style={{ margin: "0 0 1rem", fontSize: sm, fontWeight: 600, color: mutedFg, textTransform: "uppercase", letterSpacing: "0.05em" }}>Badges</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <span style={badge(primary, primFg)}>Primary</span>
              <span style={badge(secondary100, secondary)}>Secondary</span>
              <span style={badge(primary100, primary)}>Tinted</span>
              <span style={badge(`rgba(${hexToRgb(success.startsWith("#") && success.length >= 7 ? success : "#22c55e")}, 0.15)`, success)}>Success</span>
              <span style={badge(`rgba(${hexToRgb(warning.startsWith("#") && warning.length >= 7 ? warning : "#f59e0b")}, 0.15)`, warning)}>Warning</span>
              <span style={badge(`rgba(${hexToRgb(danger.startsWith("#") && danger.length >= 7 ? danger : "#ef4444")}, 0.15)`, danger)}>Error</span>
              <span style={badge(muted, mutedFg)}>Neutral</span>
              <span style={{ ...badge(muted, mutedFg), border: `1px solid ${border}` }}>Outline</span>
            </div>
          </div>
        </div>

        {/* ── Row 2: Form + Card w/ progress ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

          {/* Form controls */}
          <div style={section}>
            <p style={{ margin: "0 0 1rem", fontSize: sm, fontWeight: 600, color: mutedFg, textTransform: "uppercase", letterSpacing: "0.05em" }}>Form Controls</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label style={{ display: "block", fontSize: sm, fontWeight: 500, marginBottom: "0.3rem", color: fg }}>Email address</label>
                <input style={inputStyle} placeholder="you@example.com" readOnly />
              </div>
              <div>
                <label style={{ display: "block", fontSize: sm, fontWeight: 500, marginBottom: "0.3rem", color: fg }}>Plan</label>
                <select style={inputStyle} defaultValue="pro">
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={toggleStyle(true)}><div style={toggleKnob(true)} /></div>
                  <span style={{ fontSize: sm }}>Notifications on</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={toggleStyle(false)}><div style={toggleKnob(false)} /></div>
                  <span style={{ fontSize: sm, color: mutedFg }}>Dark mode</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", paddingTop: "0.25rem" }}>
                <button style={{ ...btnBase, backgroundColor: primary, color: primFg }}>Save changes</button>
                <button style={{ ...btnBase, backgroundColor: "transparent", color: fg, border: `1px solid ${border}` }}>Cancel</button>
              </div>
            </div>
          </div>

          {/* Card with progress */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: lg }}>Project Alpha</p>
                <p style={{ margin: "0.2rem 0 0", fontSize: sm, color: mutedFg }}>Q1 Roadmap — 4 weeks left</p>
              </div>
              <span style={badge(primary100, primary)}>Active</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              {[
                { label: "Design", pct: 90, color: primary },
                { label: "Engineering", pct: 62, color: secondary },
                { label: "QA", pct: 35, color: warning },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: sm }}>{label}</span>
                    <span style={{ fontSize: sm, color: mutedFg }}>{pct}%</span>
                  </div>
                  {progressBar(pct, color)}
                </div>
              ))}
            </div>
            <div style={dividerStyle} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "-6px" }}>
                {[["JD", primary, primFg], ["KL", secondary, secFg], ["MR", muted, mutedFg]].map(([i, b, c]) =>
                  <div key={i as string} style={{ ...{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, marginRight: "-6px", border: `2px solid ${muted}` }, backgroundColor: b as string, color: c as string }}>{i}</div>
                )}
              </div>
              <button style={{ ...btnBase, backgroundColor: "transparent", color: primary, border: `1px solid ${primary}`, padding: "0.3rem 0.75rem", fontSize: "12px" }}>View details</button>
            </div>
          </div>
        </div>

        {/* ── Row 3: Avatars + Alerts ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

          {/* Team / avatars */}
          <div style={section}>
            <p style={{ margin: "0 0 1rem", fontSize: sm, fontWeight: 600, color: mutedFg, textTransform: "uppercase", letterSpacing: "0.05em" }}>Team</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {[
                { initials: "JD", name: "Jane Doe",    role: "Product Lead",    bg: primary,    color: primFg },
                { initials: "KL", name: "Kai Lambert",  role: "Senior Engineer", bg: secondary,  color: secFg  },
                { initials: "MR", name: "Maya Reyes",   role: "UX Designer",     bg: muted,      color: mutedFg },
              ].map(({ initials, name, role, bg: ab, color: ac }) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  {avatar(initials, ab, ac)}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: sm }}>{name}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: mutedFg }}>{role}</p>
                  </div>
                  <span style={{ ...badge(primary100, primary), marginLeft: "auto", flexShrink: 0 }}>Active</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div style={section}>
            <p style={{ margin: "0 0 1rem", fontSize: sm, fontWeight: 600, color: mutedFg, textTransform: "uppercase", letterSpacing: "0.05em" }}>Alerts</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <div style={alertStyle(primary100, primary)}>
                <strong>Info:</strong> Your plan renews in 3 days.
              </div>
              <div style={alertStyle(`rgba(${hexToRgb(success.startsWith("#") && success.length >= 7 ? success : "#22c55e")}, 0.12)`, success)}>
                <strong>Success:</strong> Changes saved successfully.
              </div>
              <div style={alertStyle(`rgba(${hexToRgb(warning.startsWith("#") && warning.length >= 7 ? warning : "#f59e0b")}, 0.12)`, warning)}>
                <strong>Warning:</strong> Storage at 84% capacity.
              </div>
              <div style={alertStyle(`rgba(${hexToRgb(danger.startsWith("#") && danger.length >= 7 ? danger : "#ef4444")}, 0.12)`, danger)}>
                <strong>Error:</strong> Payment method expired.
              </div>
            </div>
          </div>
        </div>

        {/* ── Data table ── */}
        <div style={section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <p style={{ margin: 0, fontSize: sm, fontWeight: 600, color: mutedFg, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recent Activity</p>
            <button style={{ ...btnBase, backgroundColor: primary, color: primFg, fontSize: "12px", padding: "0.3rem 0.75rem" }}>Export</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: sm }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${border}` }}>
                {["Project", "Status", "Owner", "Due date", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "0.55rem 0.75rem", fontWeight: 600, color: mutedFg, fontSize: "12px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { project: "Website Redesign", status: "Active",      owner: "Jane D.",   due: "Mar 28", statusBg: primary100,                                                                           statusColor: primary   },
                { project: "Mobile App v2",    status: "In Review",   owner: "Kai L.",    due: "Apr 12", statusBg: `rgba(${hexToRgb(warning.startsWith("#") && warning.length >= 7 ? warning : "#f59e0b")}, 0.12)`, statusColor: warning   },
                { project: "API Migration",    status: "Completed",   owner: "Maya R.",   due: "Feb 28", statusBg: `rgba(${hexToRgb(success.startsWith("#") && success.length >= 7 ? success : "#22c55e")}, 0.12)`, statusColor: success   },
                { project: "Design System",    status: "Paused",      owner: "Alex T.",   due: "May 01", statusBg: muted,                                                                                statusColor: mutedFg   },
              ].map((row, i) => (
                <tr key={row.project} style={{ backgroundColor: i % 2 === 1 ? `rgba(${fgRgb}, 0.03)` : "transparent", borderBottom: `1px solid ${border}` }}>
                  <td style={{ padding: "0.65rem 0.75rem", fontWeight: 500 }}>{row.project}</td>
                  <td style={{ padding: "0.65rem 0.75rem" }}>
                    <span style={badge(row.statusBg, row.statusColor)}>{row.status}</span>
                  </td>
                  <td style={{ padding: "0.65rem 0.75rem", color: mutedFg }}>{row.owner}</td>
                  <td style={{ padding: "0.65rem 0.75rem", color: mutedFg }}>{row.due}</td>
                  <td style={{ padding: "0.65rem 0.75rem" }}>
                    <button style={{ ...btnBase, backgroundColor: "transparent", color: mutedFg, border: `1px solid ${border}`, fontSize: "12px", padding: "0.2rem 0.6rem" }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Typography ── */}
        <div style={section}>
          <p style={{ margin: "0 0 1rem", fontSize: sm, fontWeight: 600, color: mutedFg, textTransform: "uppercase", letterSpacing: "0.05em" }}>Typography</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: xl2, lineHeight: 1.2 }}>Display heading</p>
            <p style={{ margin: 0, fontWeight: 700, fontSize: xl,  lineHeight: 1.3 }}>Section heading</p>
            <p style={{ margin: 0, fontWeight: 600, fontSize: lg,  lineHeight: 1.4 }}>Subsection heading</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: base, color: mutedFg, lineHeight: 1.6, maxWidth: "480px" }}>
              Body text shows the base font size and muted foreground color. Good typography improves readability and guides users through your interface.
            </p>
            <p style={{ margin: 0, fontSize: sm, color: mutedFg, lineHeight: 1.5 }}>
              Small / caption text — used for labels, hints, and metadata.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
