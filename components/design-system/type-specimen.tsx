import type { ManifestToken } from "@/lib/tokens/generate";

const remValue = (v?: string) => (v ? parseFloat(v) : 0);

/** A type-size specimen row: sample text at the real size + name/value/utility (reference style). */
function TypeSpecimen({ token }: { token: ManifestToken }) {
  const step = token.name.replace(/^--fs-/, "");
  return (
    <div
      data-token={token.name}
      className="border-border flex items-baseline justify-between gap-6 border-b py-3 last:border-b-0"
    >
      <span className="text-foreground min-w-0 truncate" style={{ fontSize: `var(${token.name})`, lineHeight: 1.1 }}>
        The quick brown fox
      </span>
      <div className="text-muted-foreground flex shrink-0 items-baseline gap-4 font-mono text-xs">
        <code className="text-foreground">text-{step}</code>
        <span className="hidden sm:inline">{token.values.light}</span>
      </div>
    </div>
  );
}

export function TypeBody({ tokens }: { tokens: ManifestToken[] }) {
  const sorted = [...tokens].sort((a, b) => remValue(b.values.light) - remValue(a.values.light));
  return (
    <div className="flex flex-col">
      {sorted.map((t) => (
        <TypeSpecimen key={t.name} token={t} />
      ))}
    </div>
  );
}
