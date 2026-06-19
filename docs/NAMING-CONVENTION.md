# Token Naming Convention (the contract)

The lint, manifest generator, schema, and editor all key on these names. Changing a
name is a breaking change to the design system's API. Pin once; change deliberately.

## Layers
- **Runtime layer** (`:root`, `.dark` in `app/globals.css`): the authored, editable
  values. Base names below. The editor and manifest read/write ONLY this layer.
- **Utility layer** (`@theme inline` in `app/globals.css`): maps a base name into a
  Tailwind namespace, e.g. `--color-primary: var(--primary)`. Never edited at runtime.

## Rules
1. **Colors** use shadcn semantic names, kebab-case: `--<role>` and its paired
   `--<role>-foreground`. Roles: background, foreground, card, popover, primary,
   secondary, muted, accent, destructive, success, warning, info, border, input, ring.
   Color VALUES are always `oklch(...)`.
2. **Ramps** (open-ended scales) use numeric steps: `--<name>-<step>`,
   steps 50,100,200,…,900,950. Ramps in v1: `--brand-*`.
3. **Charts**: `--chart-1 … --chart-5`.
4. **Type size**: base name `--fs-<step>` (xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl), mapped to
   `--text-<step>`. Each size has a paired line-height `--lh-<step>` mapped to
   `--text-<step>--line-height`.
5. **Font family**: `--font-sans`, `--font-mono` (mapped 1:1 to the `--font-*` namespace).
   `--font-heading` is a shadcn-required alias of `--font-sans`, declared only in `@theme inline`
   (not a runtime token) so the generated card's `font-heading` class resolves; M1/M2 never see it.
6. **Font weight**: `--fw-<name>` (normal,medium,semibold,bold) → `--font-weight-<name>`.
7. **Radius**: single knob `--radius`; sm/md/lg/xl are DERIVED via calc in `@theme inline`
   (shadcn pattern) — not authored.
8. **Border width**: `--border-width-<size>` (thin,base,thick) → `border-<size>` utility.
    Plain `:root` vars + `@utility` helpers; not a Tailwind namespace.
9. **Shadow**: `--elevation-<size>` (sm,md,lg) → `--shadow-<size>`.
10. **Motion**: `--duration-<speed>` (fast,base,slow); easing `--ease-<name>`
    (standard,in,out) → `--ease-<name>`.
11. **Spacing**: ONE knob, `--spacing-base`, mapped to the `--spacing` multiplier.
    There is NO discrete `--space-N`. The whole numeric scale derives from it.
12. **Z-index**: `--z-<role>` (dropdown,sticky,modal,toast). Plain `:root` vars +
    `@utility` helpers; not a Tailwind namespace.
13. **Opacity**: `--opacity-<role>` (disabled,muted,overlay,hover). Same treatment as z-index.
14. **Container**: `--container-<size>` (sm,md,lg) → `--container-<size>` namespace.
15. **Breakpoints**: `--breakpoint-<size>` in `@theme` — documented reference, NOT
    runtime-editable (CSS media queries can't read runtime vars).

## Extending a scale (one step — F2)
Adding a value to a scale is the **same one step as color**: add the **value token** to `:root`
(`--fs-<step>`+`--lh-<step>` for type, `--elevation-<step>` for shadow, `--fw-<name>` for weight), then
`npm run tokens`. The sync pass auto-wires the `@theme` mapping (`--text-`/`--shadow-`/`--font-weight-`) and
refreshes the manifest — no hand-editing `@theme`, no machinery edits. The value-token prefix differs from
the utility (`--elevation-xl` → `shadow-xl`); use the prefix above or the utility silently won't wire.

**Radius and spacing are knobs, not per-step value tokens.** For rounder corners, change `--radius` (sm/md/lg/xl
shift with it); for spacing density, change `--spacing-base`. A genuinely new radius step is the exception —
add `--radius-<step>` to the `@theme inline` block directly (not `:root`), then `npm run tokens` (the manifest
will report it). Scales are deliberately small — reach for an existing step before extending.

## fg/bg pairing
Every color with a `-foreground` counterpart is a pair. The schema (M1) models these as
pairs so a WCAG contrast check (fast-follow) needs no re-modeling.
