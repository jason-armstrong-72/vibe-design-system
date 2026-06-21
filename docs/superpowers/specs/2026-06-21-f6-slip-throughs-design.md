# F6 slip-throughs — close the gate's blind spots — design

**Date:** 2026-06-21
**Status:** Design approved (brainstorm), pre-plan
**Milestone:** v1 fast-follow **F6** (from the M6 dogfood ledger — [docs/M6-DOGFOOD.md](../../M6-DOGFOOD.md), F6), **slip-through half only**. The brownfield baseline/incremental mode (the other half of F6) is **deferred** — the template audience clones greenfield, so it's lower priority.
**Depends on:** M5 (`lib/check/` harness), F3 (`off-token-scale`).

> **What M6 found (F6):** the blocking gate (`npm run check`) misses several off-token classes it claims to
> catch — `text-gray-500` (text palette), `color: "red"` (inline keyword color), `rounded-[5px]` (arbitrary
> radius). A 3-agent review of the fix surfaced a **fourth, larger** hole: **variant-prefixed classes
> (`md:`/`hover:`/`dark:`) bypass every arbitrary/palette rule** because `arbitrary-tailwind.ts` never strips
> the variant chain (unlike `off-token-scale.ts`). So an LLM writing `md:text-gray-500` dodges the gate today.
>
> **This spec closes all four** — same arc as F5/F3: make the gate enforce what it claims.

---

## 1. The four holes (all verified open against current `lib/check/`)

| # | Slips today | Why | Fix site |
|---|---|---|---|
| 1 | `text-gray-500` | `rePalette` prefix list omits `text` (and `placeholder`) | `arbitrary-tailwind.ts` |
| 2 | `rounded-[5px]` | `reArbLengthPrefix` omits `rounded` | `arbitrary-tailwind.ts` |
| 3 | `bg-[red]`, `color: "red"` | no CSS-named-color vocabulary anywhere | new `css-colors.ts` + both checks |
| 4 | `md:text-gray-500`, `hover:rounded-[5px]`, `dark:bg-[red]` | `checkArbitrary` never strips variant prefixes — every `^`-anchored regex misses them | `arbitrary-tailwind.ts` |

Hole #4 also affects the **existing** rules (`default-palette`, `arbitrary-color`, `arbitrary-length`,
`off-scale-spacing`), so fixing it hardens the whole gate, not just the new cases.

---

## 2. Shared vocabulary — `lib/check/css-colors.ts` (new)

A `Set<string>` of the **full standard CSS named-color list** (~148, lowercased), **including** `rebeccapurple`.
**Excludes the CSS-wide / non-color keywords** (these are legitimate, not hardcoded colors): `transparent`,
`currentcolor`, `inherit`, `initial`, `unset`, `none`, `revert`, `revert-layer`. Comparison is **case-insensitive**
(store lowercase, test `value.toLowerCase()`).

**Why the full list, not a short one (decision, overriding a reviewer):** the false-positive lever is the
**gating context** (only inside a `[...]` color-prefix utility, or a `colorProp: "value"` position with exact
membership) — *not* the list size. A bare identifier like `const orange = 1` never matches because there's no
`prop:"orange"` shape. The full list also catches legitimate-looking LLM drift like `bg-[gold]` for a premium
tier. It's a static constant (CSS named colors don't change) → negligible maintenance.

**Why a shared module used by two checks (decision, overriding a reviewer):** `bg-[red]` (a bracketed class
token) and `color:"red"` (a raw-source style literal) are genuinely two contexts owned by two different checks.
The bracket form belongs in `arbitrary-tailwind.ts` (which owns class tokenization, variant-stripping, and
prefix gating); moving it into `hardcoded-color.ts` would duplicate that logic. Sharing a **data constant**
across two legitimate consumers is normal DRY, not splitting one concern.

---

## 3. Fixes in `lib/check/arbitrary-tailwind.ts`

### 3.1 Variant-stripping (hole #4) — bracket-aware
Before matching, reduce each whitespace-split class token to its **base utility** by removing leading
`variant:` segments. Arbitrary values can contain `:` inside brackets (`bg-[url(http://x)]`), so the strip must
only consider colons **before the first `[`**:

```ts
function baseUtil(cls: string): string {
  const br = cls.indexOf("[");
  const scan = br === -1 ? cls : cls.slice(0, br);
  const lastColon = scan.lastIndexOf(":");
  return lastColon === -1 ? cls : cls.slice(lastColon + 1);
}
```

Run every existing regex (`reArbitrary`, `reArbColorPrefix`, `reArbLengthPrefix`, `reSpacingNum`, `rePalette`)
against `baseUtil(cls)`, but **report the original `cls`** in the finding (so the user sees `md:text-gray-500`,
not `text-gray-500`). Examples: `dark:bg-[red]` → `bg-[red]` (flagged); `md:hover:text-gray-500` →
`text-gray-500` (flagged); `bg-[url(http://x)]` → unchanged, inner `url(...)` not a color (safe).

**Residual (documented):** an arbitrary *variant* like `[&:hover]:text-gray-500` (starts with `[`) isn't
stripped — rare; `off-token-scale.ts`'s `split(":").pop()` has the same limitation. Acceptable.

### 3.2 text + placeholder palette (hole #1)
Add `text` and `placeholder` to the `rePalette` prefix alternation. `text-gray-500` / `placeholder-gray-500`
match `^…-(palette)-\d{2,3}$`; legit `text-primary`/`text-lg`/`text-brand-700` don't (`brand`/`chart` aren't in
the palette list — confirmed `app/pricing/page.tsx`'s `text-brand-*` stays legal). Rule stays `default-palette`,
message `MSG.defaultPalette`.

### 3.3 rounded arbitrary length (hole #2)
Add `rounded` to `reArbLengthPrefix`. `rounded-[5px]` (inner `5px` matches the existing
`^\d*\.?\d+(px|rem|em|%)$`) → rule `arbitrary-length`, message `MSG.arbitraryLength` (**generic, unchanged**).
**Decision (accepting a reviewer):** do **not** add a `--radius`-knob nudge here. That nudge belongs to the
*vocab* case (`rounded-2xl` → grow the scale, in `MSG.offTokenScale`); for an arbitrary px value the correct fix
is "use a scale step like `rounded-lg`," which is exactly what `MSG.arbitraryLength` already says. A knob message
would give wrong advice. The `var(|min(|calc(…` inner-skip already protects `rounded-[var(--radius)]`.
**Residual (documented):** units outside `px|rem|em|%` (e.g. `rounded-[9999vw]`, unitless) still slip —
pre-existing limit of the length test, not introduced here.

### 3.4 bracket named color (hole #3a)
In the arbitrary-color branch, extend the inner test: flag when inner matches the existing
`^(#|rgba?\(|hsla?\(|oklch\(|oklab\()` **OR** `cssColors.has(inner.toLowerCase())` — **exact membership, never
substring** (else `bg-[url(tan.png)]` would false-positive). Covers `bg-[red]`, `border-[blue]`, `ring-[gold]`
across all `reArbColorPrefix` prefixes. Rule `arbitrary-color`, message `MSG.arbitraryColor`.

---

## 4. Inline keyword color in `lib/check/hardcoded-color.ts` (hole #3b)

Add a line-wise match for a **color-valued property key** followed by a **quoted exact named color**:

```ts
const KEYWORD = /(?:^|[\s{;,(])(background|fill|stroke|[a-zA-Z]*[cC]olor)\s*:\s*(['"])([a-zA-Z]+)\2/g;
```

For each match, flag (rule `hardcoded-color`, `MSG.hardcodedColor(namedColor)`) **only if**
`cssColors.has(group3.toLowerCase())`. Key set = `background | fill | stroke | *Color` (the `/Color$/`-style
branch auto-covers `color`, `borderColor`, `caretColor`, `outlineColor`, `textDecorationColor`,
`borderTopColor`, SVG `stopColor`/`floodColor`, …). Anchoring requirements (false-positive guards, from review):
- Key is at a **property position** (`^` or after `{ ; , ( ` / whitespace) — so a Tailwind class substring like
  `hover:bg-red-500` or `decoration-color` inside `className="…"` can't trip it (no `prop: "value"` shape).
- Color value is **anchored to its closing quote** (`(['"])([a-zA-Z]+)\2`) — so `"reddish"`, `"darkred bg"`,
  `"var(--foreground)"`, `boxShadow: v` all **fall through** (not exact, not a bare quoted word). This keeps the
  real existing inline styles green: `borderColor: "var(--foreground)"`, `background: "var(--foreground)"`,
  `boxShadow: …` in `components/design-system/token-item.tsx`.

Catches the M6 case `color: "red"`, plus `style={{ color: "red" }}`, `borderColor: 'blue'`, `background: "red"`,
case variants (`"RED"`). Keep the existing `HEX`/`FUNC` scan + `EXEMPT` (`href=|url(|id=`) untouched — no
double-report (a named color is neither hex nor `rgb(`).
**Residual (documented):** CSS **shorthands** where the color is one token among several
(`border: "1px solid red"`, `background: "url() red"`) are **not** caught — catching them means tokenizing CSS
values, which creeps toward a parser. Out of scope; M6's actual slip was the simple `color:"red"` form.

---

## 5. Self-pass

The new rules scan `app` + `components` (excl. `components/ui`). Review grep found **zero** existing hits:
no `text-`/`placeholder-<palette>-<num>`, no `rounded-[`, no bracket named colors, and the only inline
color-prop strings are `var(--…)` (safe under exact membership). The variant-strip change can only *add*
findings for variant-prefixed off-token classes — confirm none exist in product source. The existing
`tests/check/self.test.ts` (asserts `run()` → `[]` on the repo) must stay green; verify in the plan and fix any
real hit (as F3 did with `rounded-2xl`).

---

## 6. Testing (TDD)

Inline-string cases added to the **existing** suites (`tests/check/arbitrary-tailwind.test.ts`,
`tests/check/hardcoded-color.test.ts`) — **no new fixture files / structure** (per-rule tests use the existing
`find()`/`rules()` string helpers; `__fixtures__/` is only for `files.test.ts`). Plus a unit test for
`css-colors.ts` membership/exclusions.

**Helper note (the two suites differ — don't cross them up):** `arbitrary-tailwind.test.ts`'s `find()` wraps
input as `const c = "<s>"`, so **class-token** cases (`md:text-gray-500`, `bg-[red]`, `rounded-[5px]`) go there.
`hardcoded-color.test.ts`'s `find()` passes **raw source**, so **inline-style** cases (`color: "red"`,
`borderColor: 'blue'`) go there. The bracket OR-clause (§3.4) must be tested to fire *without* disturbing the
existing `^(#|rgba?\(|…)` test (both keep firing: assert `bg-[red]` flags AND `bg-[oklch(...)]` still flags).

- **Flagged:** `text-gray-500`, `placeholder-gray-500`, `rounded-[5px]`, `bg-[red]`, `border-[gold]`,
  `md:text-gray-500`, `hover:rounded-[5px]`, `dark:bg-[red]`, and inline `color: "red"` / `borderColor: 'blue'` /
  `background: "RED"`.
- **Not flagged (FP guards):** `text-primary`, `text-lg`, `text-brand-700`, `rounded-full`, `rounded-lg`,
  `rounded-[var(--radius)]` (named guard — the highest-traffic FP risk from hole #2; confirms the
  `var(|min(|calc(` inner-skip still wins now that `rounded` is in `reArbLengthPrefix`),
  `bg-[var(--x)]`, `bg-[oklch(...)]` (already color via the hex/func test),
  `bg-[url(tan.png)]`, `border-[currentColor]`, `bg-[transparent]`, inline `borderColor: "var(--foreground)"`,
  `boxShadow: v`, a bare identifier `const orange = 1`, and the word "red" in a comment/non-color-prop string.
- **css-colors.ts:** `has("red")`/`has("RED")` true; `has("transparent")`/`has("currentcolor")`/`has("none")`/
  `has("revert")` false; `has("rebeccapurple")` true.
- **Integration:** `npm run check` on a fixture with `md:text-gray-500` exits non-zero with `default-palette`;
  `/* ds-disable: <reason> */` suppresses it.

---

## 7. Docs

**No new AGENTS.md recovery-table row** — the generic "hardcoded color / off-token class → replace with a token
utility, or add a token" row already covers all four; the radius row covers the scale case. Just richer
coverage, same messages. Update the M6 ledger (F6 slip-throughs → done; baseline still deferred).

---

## 8. Done =

`npm run check` rejects `text-gray-500`, `placeholder-gray-500`, `rounded-[5px]`, `bg-[red]`, inline
`color:"red"`, **and** their `md:`/`hover:`/`dark:`-prefixed forms — with the existing rule messages; never
false-positives on `var()`/token values, `rounded-full`, `text-brand-*`, or bare identifiers; the repo passes
its own gate unchanged; tests cover each hole + its FP guard; the variant-strip fix also closes the same hole in
the pre-existing rules. M6 F6 slip-throughs marked done (baseline mode still deferred).
