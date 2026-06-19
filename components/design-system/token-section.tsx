import type { Section } from "@/lib/design-system/sections";
import type { ManifestToken } from "@/lib/tokens/generate";
import { TokenItem } from "./token-item";
import { ColorBody } from "./color-swatch";
import { TypeBody } from "./type-specimen";

/** The 4 read-only steps the single --radius knob derives (offset, not separate tokens). */
const RADIUS_STEPS: { cls: string; util: string; note: string }[] = [
  { cls: "rounded-sm", util: "rounded-sm", note: "−4px" },
  { cls: "rounded-md", util: "rounded-md", note: "−2px" },
  { cls: "rounded-lg", util: "rounded-lg", note: "base" },
  { cls: "rounded-xl", util: "rounded-xl", note: "+4px" },
];

function RadiusBody({ tokens }: { tokens: ManifestToken[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tokens.map((t) => (
          <TokenItem key={t.name} token={t} />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          Derived steps · read-only
        </h3>
        <div className="flex flex-wrap gap-4">
          {RADIUS_STEPS.map((s) => (
            <div key={s.util} className="flex w-20 flex-col gap-1.5">
              <div className={`border-foreground/30 bg-muted size-16 border-2 ${s.cls}`} />
              {/* ds-disable: dense token label, below --fs-xs */}
              <code className="text-foreground font-mono text-[11px] leading-tight">{s.util}</code>
              {/* ds-disable: dense token label, below --fs-xs */}
              <span className="text-muted-foreground font-mono text-[10px] leading-tight">{s.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionBody({ section }: { section: Section }) {
  if (section.group === "color") return <ColorBody tokens={section.tokens} />;
  if (section.group === "fontSize") return <TypeBody tokens={section.tokens} />;
  if (section.group === "radius") return <RadiusBody tokens={section.tokens} />;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {section.tokens.map((t) => (
        <TokenItem key={t.name} token={t} />
      ))}
    </div>
  );
}

export function TokenSection({ section }: { section: Section }) {
  return (
    <section
      id={section.group}
      className="border-border bg-card flex scroll-mt-24 flex-col gap-6 rounded-xl border p-6 shadow-sm sm:p-8"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
        <span className="text-muted-foreground font-mono text-xs">{section.tokens.length} tokens</span>
      </div>
      <SectionBody section={section} />
    </section>
  );
}
