<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:design-system -->
# Design system contract

**Law:** style with the design system's Tailwind token utilities (`bg-primary`, `p-4`, `text-lg`, `rounded-lg`) or CSS vars (`var(--primary)`). Never hardcode a color, size, font, or duration. Off-token classes produce no styles **and** fail `npm run check`.

**The token reference is generated and always current:** see [`design-system.md`](design-system.md) for the full token table, usage rules, and the one-step extension procedure. Read it before building.

**Need a value the system lacks?** Follow the extension procedure in `design-system.md` (for a color: add it to BOTH `:root` and `.dark` in `app/globals.css`, then `npm run tokens`). The new token auto-appears on `/design-system` and becomes editable in the visual editor — extend the system, don't hardcode.

**The gate (`npm run check`, also run in CI + pre-commit) and how to fix each failure:**

| Failure | Fix |
|---|---|
| stale manifest | `npm run tokens && git add design-system.*` |
| color in one theme only | add it to both `:root` and `.dark`, then `npm run tokens` |
| hardcoded color / off-token class | replace with a token utility, or add a token via the procedure |
| off-scale spacing | use a step on the spacing scale (or extend `lib/check/spacing-steps.ts`) |
| off-token scale step (`text-8xl`, `shadow-xl`, `font-black` — produces no styles) | use a defined step, or add the value token to `:root` (`--fs-`/`--elevation-`/`--fw-`) then `npm run tokens` — one step, like color |
| off-token radius (`rounded-2xl`/`rounded-3xl` — produces no styles) | for rounder corners overall, increase the `--radius` knob then `npm run tokens`; for a one-off step, add `--radius-<step>` to `@theme` |
| color pair below WCAG-AA contrast (`bg`/`bg-foreground`) | raise/lower the foreground token's oklch L in the failing block (`:root` or `.dark`) until ≥ 4.5:1 (3:1 for muted/large), then `npm run tokens` |
| deliberate one-off | `/* ds-disable: <reason> */` on the line above (reason required) |

_The gate runs on `npm run check` / pre-commit / CI — not as live editor squiggles._
<!-- END:design-system -->
