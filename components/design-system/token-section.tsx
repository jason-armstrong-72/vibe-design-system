import type { Section } from "@/lib/design-system/sections";
import { TokenItem } from "./token-item";

export function TokenSection({ section }: { section: Section }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold text-foreground">{section.title}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {section.tokens.map((t) => (
          <TokenItem key={`${t.name}`} token={t} />
        ))}
      </div>
    </section>
  );
}
