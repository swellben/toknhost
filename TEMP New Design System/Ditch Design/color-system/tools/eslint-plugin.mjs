// ESLint plugin: applies the color rules to component code. Scans string values
// (class names, style values, SVG attributes) with the same scanner the checker
// and the Claude Code hook use.
import { loadSystem, matchesGlobs, scanSource } from "./lib.mjs"

let sys
const system = () => (sys ??= loadSystem())

const usage = {
  meta: {
    type: "problem",
    docs: { description: "Colors must come from theme tokens, used where color-system/rules.json allows." },
    schema: [],
  },
  create(context) {
    const file = context.filename
    if (!matchesGlobs(file, system().adapter.source.files)) return {}
    const check = (node, value) => {
      if (typeof value !== "string" || !value) return
      for (const v of scanSource(system(), file, value)) context.report({ node, message: `[${v.id}] ${v.message}` })
    }
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.cooked),
    }
  },
}

const plugin = { meta: { name: "color-system" }, rules: { usage } }
export default plugin
