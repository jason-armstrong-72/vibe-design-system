# vibe-design-system

A **design-system starter template** for building a website or SaaS app with an LLM (vibe coders).

One source of truth — CSS custom properties in `app/globals.css` — read and written by three consumers:

- **the app** renders from it,
- **a built-in visual editor** writes to it (dev-only, point-and-click),
- **the LLM** reads it to build and is held to it by a blocking lint.

You install the template, then build on it. Edits to a token ripple everywhere it's used. When the LLM
needs a value the system lacks, it extends the system (adds a token) instead of hardcoding — and the new
token auto-appears on the `/design-system` page, ready to edit.

**Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui.

**Building with an LLM?** Point your assistant at `AGENTS.md` + `design-system.md`. Claude Code, Cursor,
Gemini CLI, and GitHub Copilot auto-load the contract (`CLAUDE.md` / `.cursor/rules` / `GEMINI.md` /
`.github/copilot-instructions.md`); for any other tool (Windsurf, Cline, aider, web chat), open or paste
those two files. _(On Gemini CLI, run `/memory show` to confirm the contract loaded — `@`-import support is
version-dependent.)_

## Themes

Pick a look at adoption time, then fine-tune in the editor. Default is **Neutral** (already applied —
doing nothing is valid).

```bash
npm run theme neutral    # calm, professional default
npm run theme swiss      # austere, monochrome, grid + whitespace
npm run theme brutalist  # raw, thick borders, hard shadows, mono
```

`npm run theme <name>` swaps the preset's values into `app/globals.css` and regenerates the manifest.
Token **names** are the fixed contract; only values change — so every consumer (app, editor, lint, the
manifest) works unchanged. Each theme passes WCAG-AA contrast (light + dark) and renders without overflow.

| Neutral | Swiss | Brutalist |
|---|---|---|
| ![Neutral](themes/screenshots/neutral.png) | ![Swiss](themes/screenshots/swiss.png) | ![Brutalist](themes/screenshots/brutalist.png) |

_(Five more — Editorial, Warm, Pastel, Technical, Corporate — are a fast-follow on the same machinery.)_

## Visual editor (dev-only)

Run `npm run dev` and open `/design-system`. Click **Edit** (bottom-right) → click any swatch, type
sample, or component → a docked panel edits that token point-and-click (OKLCH color picker, sliders,
eyedropper, reuse-a-token swatches, contrast badge). Changes preview instantly and persist to
`app/globals.css`, so they ripple everywhere the token is used. Light/dark block toggle, undo/redo
(⌘Z / ⌘⇧Z), and reset included. The editor and its write API are **dev-only** — stripped from production
builds.

## Status

**v1 complete (M0–M6)** + shipped fast-follows: F2 (one-step non-color extension), F3 (off-token-scale
check), F5 (honest standalone `check`). The token system, living `/design-system` page, visual editor, and
blocking lint are all in place. See [docs/HANDOFF.md](docs/HANDOFF.md) for the live status and remaining
fast-follows.
