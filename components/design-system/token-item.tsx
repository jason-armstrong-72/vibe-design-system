import type { CSSProperties, ReactNode } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";

/** A group-appropriate visual preview, backed by the token's CSS var so it tracks live edits. */
function preview(token: ManifestToken): ReactNode {
  const v = `var(${token.name})`;
  const box = (style: CSSProperties) => (
    <div
      data-preview="box"
      className="size-12 shrink-0 rounded-md border border-border bg-card"
      style={style}
    />
  );

  switch (token.group) {
    case "color":
      return (
        <div
          data-preview="swatch"
          className="size-12 shrink-0 rounded-md border border-border"
          style={{ background: v }}
        />
      );
    case "fontSize":
      return (
        <span data-preview="type" className="shrink-0 leading-none" style={{ fontSize: v }}>
          Ag
        </span>
      );
    case "fontFamily":
      return (
        <span data-preview="family" className="shrink-0 text-2xl" style={{ fontFamily: v }}>
          Ag
        </span>
      );
    case "fontWeight":
      return (
        <span data-preview="weight" className="shrink-0 text-2xl" style={{ fontWeight: v as unknown as number }}>
          Ag
        </span>
      );
    case "lineHeight":
      return (
        <span data-preview="leading" className="block max-w-40 text-sm" style={{ lineHeight: v }}>
          The quick brown fox jumps over the lazy dog.
        </span>
      );
    case "radius":
      return box({ borderRadius: v });
    case "borderWidth":
      return box({ borderWidth: v, borderStyle: "solid", borderColor: "var(--foreground)" });
    case "shadow":
      return box({ boxShadow: v });
    case "spacing":
      return <div data-preview="bar" className="h-6 bg-primary" style={{ width: `calc(${v} * 16)` }} />;
    case "opacity":
      return box({ opacity: v as unknown as number, background: "var(--foreground)" });
    case "duration":
    case "easing":
      return (
        <div
          data-preview="motion"
          className="size-3 rounded-full bg-primary motion-safe:animate-pulse"
          style={token.group === "duration" ? { animationDuration: v } : { animationTimingFunction: v }}
        />
      );
    default:
      // zIndex / container and any future group: meta-only, value shown below
      return null;
  }
}

export function TokenItem({ token }: { token: ManifestToken }) {
  const value = token.values.dark
    ? `${token.values.light} / ${token.values.dark}`
    : token.values.light ?? "";
  const hint = token.utilities.length ? token.utilities.join("  ") : token.usage ?? "";

  return (
    <div
      data-token={token.name}
      className="bg-card hover:bg-muted/50 flex items-center gap-4 px-4 py-3 transition-colors"
    >
      <div className="flex min-h-12 w-16 shrink-0 items-center justify-center">{preview(token)}</div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <code className="text-foreground font-mono text-sm">{token.name}</code>
        <span className="text-muted-foreground truncate font-mono text-xs">{value}</span>
        {hint ? <span className="text-muted-foreground truncate text-xs">{hint}</span> : null}
      </div>
    </div>
  );
}
