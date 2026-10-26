@AGENTS.md

## Colors
- Color rules live in `color-system/rules.json`; values in `color-system/themes/`; library token names in `color-system/adapters/`.
- In components use theme tokens only. Never write color literals, palette steps (`--palette-*`) or framework palette classes.
- Never edit generated files (`src/app/colors.generated.css`, `color-system/generated/`, the color modes of `design/figma-variables.tokens.json`). Change the theme or adapter, then run `npm run colors:generate`.
- Run `npm run check` before finishing a change.
