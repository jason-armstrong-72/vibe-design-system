import type { Section } from "@/lib/design-system/sections";
import { TokenItem } from "./token-item";

export function TokenSection({ section, index }: { section: Section; index?: number }) {
  return (
    <section className="flex scroll-mt-24 flex-col gap-4" id={section.group}>
      <div className="border-border flex items-baseline justify-between border-b pb-2">
        <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
        <span className="text-muted-foreground font-mono text-xs">
          {index !== undefined ? `${String(index).padStart(2, "0")} · ` : ""}
          {section.tokens.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {section.tokens.map((t) => (
          <TokenItem key={t.name} token={t} />
        ))}
      </div>
    </section>
  );
}
