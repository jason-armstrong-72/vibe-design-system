<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:design-system -->
# Design system contract

**Law:** style with the design system's Tailwind token utilities (`bg-primary`, `p-4`, `text-lg`, `rounded-lg`) or CSS vars (`var(--primary)`). Never hardcode a color, size, font, or duration. Off-token classes produce no styles **and** fail `npm run check`.

**Variant prefixes don't exempt a class** — `md:bg-[red]`, `hover:rounded-[5px]`, `dark:text-gray-500` are rejected exactly like their unprefixed forms.

**The token reference is generated and always current:** see [`design-system.md`](design-system.md) for the full token table, usage rules, and the one-step extension procedure. Read it before building.

**Need a value the system lacks?** Follow the extension procedure in `design-system.md` (for a color: add it to BOTH `:root` and `.dark` in `app/globals.css`, then `npm run tokens`). The new token auto-appears on `/design-system` and becomes editable in the visual editor — extend the system, don't hardcode. If no existing token fits the *meaning* (not just the syntax), extend — don't repurpose a semantically-wrong token (e.g. `warning` for a celebratory promo).

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

**Adopting onto an existing codebase (brownfield).** `npm run check:baseline` records the project's *current* violations to `.ds-baseline.json` so the gate then only flags **new** code. It is a **one-time human adoption step**, run once when the template is first added to a pre-existing repo — **not** a tool you reach for when the gate goes red on your work.

- The **Law above is unchanged for any code you write or edit.** Baseline mode only means: don't treat *pre-existing, human-authored* debt as yours to refactor unless asked.
- If the gate goes red on code **you** wrote this session, that is **never** baseline-eligible — **fix it** (or extend the system per the procedure).
- **Never run `check:baseline` yourself to clear errors.** If you believe the baseline genuinely needs regenerating, **stop and ask the human** — re-baselining to silence your own violations defeats the design system and silently ships broken styling.
- Don't auto-refactor a brownfield repo's legacy code to tokens unless the human asks; automatic conversion isn't part of this template yet.

**Components:** the available UI primitives (with imports + usage) are catalogued in [`design-system.components.md`](design-system.components.md) (generated). **Import and use them — do not hand-roll dialogs, dropdowns, toggles, etc.** New primitives go in `components/ui/*` and MUST be registered in `lib/catalog/registry.ts` (the `catalog-fresh` gate enforces this).

**Icons:** the bundled icon set is `@untitled-ui/icons-react` (1173 icons), default `size-4`, color via `text-*` tokens. (`lucide-react` is present but a broken version — do not use it.)
<!-- END:design-system -->
