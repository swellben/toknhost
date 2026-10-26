#!/usr/bin/env node
// Claude Code PostToolUse hook (Edit|Write|MultiEdit). Reads the hook payload on
// stdin. For component and style files it scans the edited file; for the color
// system's own files it regenerates outputs and runs the checks. Exits 2 with
// the problems on stderr so the agent sees them and fixes the edit.
import fs from "node:fs"
import path from "node:path"
import { buildOutputs } from "./generate.mjs"
import { runChecks } from "./check.mjs"
import { CS, ROOT, loadSystem, matchesGlobs, rel, scanSource } from "./lib.mjs"

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}")
const file = input.tool_input?.file_path || input.tool_response?.filePath
if (!file) process.exit(0)
const abs = path.resolve(file)
if (!abs.startsWith(ROOT + path.sep)) process.exit(0)

const sys = loadSystem()
const problems = []

if (abs.startsWith(CS + path.sep) && /\.json$/.test(abs) && !abs.includes(`${path.sep}generated${path.sep}`)) {
  for (const [out, content] of Object.entries(buildOutputs(sys))) {
    const p = path.join(ROOT, out)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, content)
  }
  const accepted = new Set(JSON.parse(fs.readFileSync(path.join(CS, sys.config.baseline), "utf8")).accepted)
  for (const i of runChecks(loadSystem())) if (i.severity === "error" && !accepted.has(i.id)) problems.push(i.message)
} else if (matchesGlobs(abs, [...sys.adapter.source.files, ...sys.adapter.source.styleFiles]) && fs.existsSync(abs)) {
  for (const v of scanSource(sys, abs, fs.readFileSync(abs, "utf8"))) problems.push(`${rel(abs)}:${v.line} [${v.id}] ${v.message}`)
}

if (problems.length) {
  process.stderr.write(`Color system: ${problems.length} problem(s). Rules: color-system/rules.json.\n${problems.join("\n")}\n`)
  process.exit(2)
}
