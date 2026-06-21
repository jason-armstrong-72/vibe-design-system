# Polish bundle (F5 cosmetic + F1 nudge) — design

**Date:** 2026-06-21
**Status:** Design approved (brainstorm), pre-plan
**Milestone:** v1 fast-follows — the F5 deferred cosmetic (from the F5 ship) + M6 finding **F1** (LLMs reuse over extend). Two small, independent loose ends in one branch.
**Depends on:** F5 (`lib/check/contrast.ts`, `lib/tokens/contrast.ts`), M2 (`lib/tokens/generate.ts` manifest preamble).

---

## Part A — F5 cosmetic: redundant `.dark` contrast finding

**The wart:** `effective()` (`lib/tokens/contrast.ts:14-21`) resolves a dark lookup by falling back to the light
value when a token has no own `.dark` declaration. For a color present in `:root` only (e.g. a freshly-invented
`--promo`/`--promo-foreground` mid-extension), `contrastResults` emits the pair **twice** — once for `light`,
once for `dark` (same fallback values) — so a single below-AA invented pair produces a `:root` **and** a `.dark`
`contrast` finding, the latter telling the user to edit the `.dark` block where the token doesn't exist yet.
Meanwhile `both-theme` is already flagging "add `--promo` to `.dark`". Net: noisy, slightly contradictory output
for that one transient state.

**Fix — isolated to `lib/check/contrast.ts`:** after `contrastResults`, drop a **dark** finding when *neither*
the bg nor the fg token has its **own** `.dark` declaration (i.e. the dark result is pure fallback). `both-theme`
owns the "add it to `.dark`" instruction; once the user adds the dark block, the real dark values are
contrast-checked on the next run.

```ts
export function checkContrast(globalsCss: string): Finding[] {
  const tokens = parseTokens(globalsCss);
  const ownDark = (n: string) => tokens.some((t) => t.name === n && t.theme === "dark");
  return contrastResults(tokens)
    .filter((r) => !r.pass)
    .filter((r) => !(r.theme === "dark" && !ownDark(r.bg) && !ownDark(r.fg)))
    .map((r) => ({ file: "app/globals.css", line: 0, rule: "contrast",
                   message: MSG.contrastBelow(r.fg, r.bg, r.theme, r.ratio, r.min) }));
}
```

**Why not touch `contrastResults` (the shared fn):** it's also consumed by the theme-AA tests over
`themes/*.css`, where `:root`-only tokens legitimately fall back to light in dark. Filtering fallback-dark pairs
there would drop those pairs and could trip `tests/themes/contrast.test.ts`'s `results.length >= 16` assertion.
Keeping the filter in `checkContrast` leaves `contrastResults` + the theme tests untouched.

**Scope guards:**
- **Normal both-block tokens are unaffected** — they have own-dark declarations, so `ownDark` is true and both
  themes are still checked (a genuinely below-AA `.dark` value still flags).
- **Only the dark, pure-fallback, *failing* finding is suppressed** — the `:root` finding for the same pair
  still fires, so the problem is still surfaced once.
- Runtime note: a `:root`-only token *does* apply in dark via the cascade, so the suppressed dark finding isn't
  "wrong" — it's redundant with the `:root` finding + `both-theme`, and resolves correctly once `.dark` is added.

## Part B — F1 nudge: extend over semantically-wrong reuse

**The finding (M6 F1):** capable LLMs default to grabbing a syntactically-usable but *semantically-wrong*
existing token (e.g. `warning`/`success` for a celebratory promo) rather than running the easy extension
procedure. The gate passes it (a real token used correctly), so the system is satisfied but the *meaning* is off.

**Fix — one line, doc-only**, in the extension-procedure section of:
1. the **generated** manifest preamble — edit `lib/tokens/generate.ts` (the preamble source), then `npm run tokens`
   to regenerate `design-system.{md,json}`;
2. the `AGENTS.md` "Need a value the system lacks?" paragraph.

Wording (single sentence, match surrounding style):
> If no existing token fits the **meaning** (not just the syntax), extend — don't repurpose a
> semantically-wrong token (e.g. `warning` for a celebratory promo).

It's a nudge, not an enforceable rule (semantic fit isn't machine-checkable); the gate is unchanged.

---

## Testing

**Part A** — `tests/check/contrast.test.ts` (extend):
- `:root`-only below-AA `--promo`/`--promo-foreground` fixture → **exactly one** `contrast` finding, naming
  `:root` (not two; no `.dark` finding).
- A below-AA pair present in **both** blocks → still **two** findings (`:root` + `.dark`) — proves the filter
  only suppresses pure-fallback dark, not real dark failures.
- Real `app/globals.css` → `[]` (baseline guard, unchanged).
- `tests/themes/contrast.test.ts` must stay green (assert in the plan; `contrastResults` untouched).

**Part B** — doc-only; `npm run tokens` regenerates the manifest so `manifest-fresh` stays green. Optionally
assert the preamble contains the nudge (the existing `tests/check/self.test.ts` + manifest-fresh cover freshness;
no new test strictly required — the plan may add a one-line grep-style assertion if cheap).

---

## Done =

A `:root`-only below-AA invented color produces a single `contrast` finding (plus `both-theme`'s "add to .dark"),
not a contradictory pair; both-block below-AA pairs still flag in both themes; `contrastResults` + theme tests
untouched; the extension procedure (generated preamble + AGENTS) nudges extending over semantically-wrong reuse;
`npm run check` + full suite green; F5 cosmetic + M6 F1 marked addressed in the ledgers.
