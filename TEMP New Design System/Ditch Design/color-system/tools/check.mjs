#!/usr/bin/env node
// Verifies the theme + adapter against rules.json and the generated files
// against their sources. Exit 1 on any error not listed in the baseline.
//   node color-system/tools/check.mjs                  run all checks
//   node color-system/tools/check.mjs --update-baseline  accept current errors
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { buildOutputs } from "./generate.mjs"
import {
  CS, ROOT, contrast, expandIntents, loadSystem, matchesAny, patternToRegex,
  resolveIntent, scanSource, splitRef, stepHex, walk, rel,
} from "./lib.mjs"

export function runChecks(sys = loadSystem()) {
  const { rules, theme, adapter } = sys
  const issues = []
  const add = (severity, id, message) => issues.push({ severity, id, message })

  // Structure: every role slot filled in every mode, with a real palette step
  for (const mode of rules.modes) {
    for (const [role, def] of Object.entries(rules.roles)) {
      for (const slot of def.slots) {
        const step = theme.roles[mode]?.[role]?.[slot]
        if (!step) add("error", `theme:missing:${mode}:${role}.${slot}`, `Theme "${theme.name}" has no ${mode} value for ${role}.${slot}.`)
        else if (!stepHex(sys, step)) add("error", `theme:unknown-step:${mode}:${role}.${slot}`, `${role}.${slot} (${mode}) points at "${step}", which is not in the palette.`)
      }
    }
  }
  // Intents point at declared role slots, and only roles they may access
  const access = Object.entries(rules.constraints.roleAccess).filter(([k]) => k !== "about")
  for (const [intent, ref] of Object.entries(rules.intents)) {
    const [role, slot] = splitRef(ref)
    if (!rules.roles[role]?.slots.includes(slot)) { add("error", `rules:bad-ref:${intent}`, `Intent ${intent} points at undeclared slot ${ref}.`); continue }
    for (const [rolePattern, allowed] of access) {
      if (patternToRegex(rolePattern).test(role) && !matchesAny(intent, allowed)) {
        add("error", `role-access:${intent}`, `Intent ${intent} uses role ${role}, which only ${allowed.join(", ")} may use.`)
      }
    }
  }
  // Adapter only exposes known intents
  for (const [token, intent] of Object.entries(adapter.tokens)) {
    if (!rules.intents[intent]) add("error", `adapter:unknown-intent:${token}`, `Adapter token "${token}" maps to unknown intent "${intent}".`)
  }
  for (const intent of Object.keys(rules.intents)) {
    if (!Object.values(adapter.tokens).includes(intent)) add("warning", `adapter:unexposed:${intent}`, `Intent ${intent} has no token in the adapter.`)
  }
  if (issues.some((i) => i.severity === "error" && i.id.startsWith("theme:"))) return issues

  // Contrast contracts
  for (const c of rules.constraints.contrast) {
    for (const fg of expandIntents(rules, c.fg)) {
      for (const bgPattern of c.bg) {
        let bgs = expandIntents(rules, bgPattern)
        if (c.pair === "same-status") bgs = bgs.filter((b) => b.split(".")[1] === fg.split(".")[1])
        for (const bg of bgs) {
          for (const mode of rules.modes) {
            const r = contrast(stepHex(sys, resolveIntent(sys, fg, mode)), stepHex(sys, resolveIntent(sys, bg, mode)))
            if (r < c.min) add("error", `contrast:${fg}/${bg}:${mode}`, `${fg} on ${bg} is ${r.toFixed(2)}:1 in ${mode} mode; needs ${c.min}:1.`)
          }
        }
      }
    }
  }
  // Distinctness
  for (const d of rules.constraints.distinct) {
    for (const subject of expandIntents(rules, d.subject)) {
      for (const otherPattern of d.mustDifferFrom) {
        for (const other of expandIntents(rules, otherPattern)) {
          for (const mode of rules.modes) {
            const a = resolveIntent(sys, subject, mode), b = resolveIntent(sys, other, mode)
            if (a === b) add(d.severity, `distinct:${d.id}:${subject}=${other}:${mode}`, `${subject} and ${other} are the same color (${a}) in ${mode} mode. ${d.about}`)
          }
        }
      }
    }
  }
  // Generated files match their sources
  for (const [file, content] of Object.entries(buildOutputs(sys))) {
    const p = path.join(ROOT, file)
    if (!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== content) add("error", `drift:${file}`, `${file} is out of date or edited by hand. Run \`npm run colors:generate\`.`)
  }
  // Hand-written stylesheets use tokens only (component code is covered by the ESLint rule)
  for (const file of walk(path.join(ROOT, "src"), adapter.source.styleFiles)) {
    for (const v of scanSource(sys, file, fs.readFileSync(file, "utf8"))) add("error", `source:${v.id}:${rel(file)}:${v.line}`, `${rel(file)}:${v.line} ${v.message}`)
  }
  return issues
}

function loadBaseline(sys) {
  const p = path.join(CS, sys.config.baseline)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : { accepted: [] }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sys = loadSystem()
  const issues = runChecks(sys)
  const baseline = loadBaseline(sys)
  if (process.argv.includes("--update-baseline")) {
    const accepted = issues.filter((i) => i.severity === "error").map((i) => i.id).sort()
    fs.writeFileSync(path.join(CS, sys.config.baseline), JSON.stringify({ about: "Known color-rule errors accepted for now. Checks fail only on errors not listed here. Remove an entry once it is fixed.", accepted }, null, 2) + "\n")
    console.log(`Baseline updated: ${accepted.length} accepted errors.`)
    process.exit(0)
  }
  const accepted = new Set(baseline.accepted)
  const fresh = issues.filter((i) => i.severity === "error" && !accepted.has(i.id))
  const known = issues.filter((i) => i.severity === "error" && accepted.has(i.id))
  const warnings = issues.filter((i) => i.severity === "warning")
  const stale = baseline.accepted.filter((id) => !issues.some((i) => i.id === id))
  for (const i of fresh) console.log(`✖ ${i.message}`)
  for (const i of known) console.log(`! (baseline) ${i.message}`)
  for (const i of warnings) console.log(`· ${i.message}`)
  for (const id of stale) console.log(`✓ fixed, remove from baseline: ${id}`)
  console.log(`\n${fresh.length} new errors, ${known.length} baselined, ${warnings.length} warnings. Budget (${Object.entries(sys.rules.constraints.budget).filter(([k]) => !["about", "enforcement"].includes(k)).map(([k, v]) => `${k} ${v}%`).join(", ")}) is advisory and not measured statically.`)
  process.exit(fresh.length ? 1 : 0)
}
