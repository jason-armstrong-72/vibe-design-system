import type { ManifestToken } from "@/lib/tokens/generate";

/** Which family a color token belongs to (for the labeled rows, like the reference). */
function family(name: string): "Semantic" | "Status" | "Brand" | "Chart" {
  const b = name.slice(2);
  if (/^brand-/.test(b)) return "Brand";
  if (/^chart-/.test(b)) return "Chart";
  if (/^(success|warning|info)/.test(b)) return "Status";
  return "Semantic";
}

const FAMILY_ORDER = ["Semantic", "Status", "Brand", "Chart"] as const;

/** Trailing numeric step (brand-50 -> 50, chart-3 -> 3), or NaN. */
function step(name: string): number {
  const m = name.match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : NaN;
}

/** Sort a family by numeric step ascending (50,100,…,950); non-numbered keep order (stable). */
function byShade(a: ManifestToken, b: ManifestToken): number {
  const na = step(a.name);
  const nb = step(b.name);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return 0;
}

/** One large rounded swatch with the hang-tag notch + a hover overlay showing full details. */
function ColorSwatch({ token }: { token: ManifestToken }) {
  const label = token.name.slice(2);
  const hint = token.utilities.join("  ");
  return (
    <div data-token={token.name} className="group relative flex w-20 flex-col gap-1.5">
      <div
        data-preview="swatch"
        className="border-border relative aspect-square w-full rounded-xl border shadow-sm"
        style={{ background: `var(${token.name})` }}
      >
        {/* hang-tag notch — reads as a punched hole */}
        <span className="bg-background border-border absolute right-2 top-2 size-2.5 rounded-full border" />
      </div>
      {/* ds-disable: dense token label, below --fs-xs */}
      <code className="text-foreground truncate font-mono text-[11px] leading-tight">{label}</code>
      {/* ds-disable: dense token label, below --fs-xs */}
      <span className="text-muted-foreground truncate font-mono text-[10px] leading-tight">
        {token.values.light}
      </span>

      {/* hover overlay — readable name, light/dark values, utilities */}
      <div className="bg-popover text-popover-foreground border-border pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 flex-col gap-1 whitespace-nowrap rounded-lg border p-3 text-xs shadow-lg group-hover:flex">
        <code className="font-mono font-medium">{token.name}</code>
        <div className="text-muted-foreground flex flex-col gap-0.5 font-mono">
          <span>light: {token.values.light}</span>
          {token.values.dark ? <span>dark:&nbsp; {token.values.dark}</span> : null}
        </div>
        {hint ? <div className="text-muted-foreground font-mono">{hint}</div> : null}
      </div>
    </div>
  );
}

export function ColorBody({ tokens }: { tokens: ManifestToken[] }) {
  return (
    <div className="flex flex-col gap-8">
      {FAMILY_ORDER.map((fam) => {
        const items = tokens.filter((t) => family(t.name) === fam).sort(byShade);
        if (items.length === 0) return null;
        return (
          <div key={fam} className="flex flex-col gap-3">
            <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {fam}
            </h3>
            <div className="flex flex-wrap gap-4">
              {items.map((t) => (
                <ColorSwatch key={t.name} token={t} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
