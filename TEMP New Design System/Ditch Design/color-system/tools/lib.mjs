// Shared logic for the color system: loading, intent resolution, contrast,
// source scanning and glob matching. Design-system agnostic: everything
// library-specific comes from the adapter JSON.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
export const CS = path.join(ROOT, "color-system")

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"))

// Theme and adapter are chosen in color-system/config.json so a project can
// swap either without touching tools.
export function loadSystem() {
  const config = readJson(path.join(CS, "config.json"))
  const rules = readJson(path.join(CS, "rules.json"))
  const theme = readJson(path.join(CS, config.theme))
  const adapter = readJson(path.join(CS, config.adapter))
  return { config, rules, theme, adapter }
}

export const splitRef = (ref) => {
  const i = ref.lastIndexOf(".")
  return [ref.slice(0, i), ref.slice(i + 1)]
}

// "status.*.fill" matches "status.error.fill"; "data.series.*" matches "data.series.3"
export function patternToRegex(pattern) {
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+(?:\\.[^.]+)*")
  return new RegExp(`^${esc}$`)
}
export const matchesAny = (name, patterns) => patterns.some((p) => patternToRegex(p).test(name))
export const expandIntents = (rules, pattern) =>
  Object.keys(rules.intents).filter((i) => patternToRegex(pattern).test(i))

// intent -> palette step key, per mode
export function resolveIntent(sys, intent, mode) {
  const ref = sys.rules.intents[intent]
  if (!ref) throw new Error(`Unknown intent ${intent}`)
  const [role, slot] = splitRef(ref)
  return sys.theme.roles[mode]?.[role]?.[slot] ?? null
}
export const stepHex = (sys, step) => sys.theme.palette[step] ?? null

// WCAG 2.x relative luminance and contrast
function luminance(hex) {
  const h = hex.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// Minimal glob: **, *, {a,b}
export function globToRegex(glob) {
  let re = ""
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === "*" && glob[i + 1] === "*") { re += ".*"; i++; if (glob[i + 1] === "/") i++ }
    else if (c === "*") re += "[^/]*"
    else if (c === "{") { const end = glob.indexOf("}", i); re += `(?:${glob.slice(i + 1, end).split(",").map(escapeRe).join("|")})`; i = end }
    else re += escapeRe(c)
  }
  return new RegExp(`^${re}$`)
}
const escapeRe = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
export const rel = (file) => path.relative(ROOT, path.resolve(file)).split(path.sep).join("/")
export const matchesGlobs = (file, globs) => globs.some((g) => globToRegex(g).test(rel(file)))

export function componentKind(sys, file) {
  for (const [kind, globs] of Object.entries(sys.adapter.source.componentKinds)) if (matchesGlobs(file, globs)) return kind
  return "general"
}

// Scan source text for forbidden color usage and out-of-scope intents.
// Returns [{ line, column, id, message }]. Used by the ESLint rule, the
// checker (for CSS) and the Claude Code hook, so all three agree.
export function scanSource(sys, file, text) {
  const { adapter, rules } = sys
  if (matchesGlobs(file, adapter.source.generated)) return []
  const out = []
  const lineOf = (idx) => {
    const before = text.slice(0, idx)
    const line = before.split("\n").length
    return { line, column: idx - before.lastIndexOf("\n") }
  }
  for (const f of adapter.source.forbidden) {
    for (const m of text.matchAll(new RegExp(f.pattern, "g"))) out.push({ ...lineOf(m.index), id: f.id, message: `${f.message} Found "${m[0]}".` })
  }
  const tokens = Object.keys(adapter.tokens).sort((a, b) => b.length - a.length).map(escapeRe).join("|")
  const kind = componentKind(sys, file)
  const scopes = Object.entries(rules.constraints.intentScopes).filter(([k]) => k !== "about")
  for (const u of adapter.source.tokenUsage) {
    for (const m of text.matchAll(new RegExp(u.pattern.replace("{tokens}", tokens), "g"))) {
      const token = m.groups.token
      const intent = adapter.tokens[token]
      for (const [pattern, kinds] of scopes) {
        if (patternToRegex(pattern).test(intent) && !kinds.includes(kind)) {
          out.push({ ...lineOf(m.index), id: "intent-scope", message: `"${m[0]}" uses ${intent}, which is only allowed in ${kinds.join(", ")} components (this file is ${kind}).` })
        }
      }
    }
  }
  return out
}

export function walk(dir, globs) {
  const files = []
  const visit = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) visit(p)
      else if (matchesGlobs(p, globs)) files.push(p)
    }
  }
  visit(dir)
  return files
}
