import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import { groupedSections } from "@/lib/design-system/sections";
import { TokenSection } from "@/components/design-system/token-section";
import { ComponentShowcase } from "@/components/design-system/component-showcase";

export default function DesignSystemPage() {
  const manifest = designSystem as Manifest;
  const sections = groupedSections(manifest);

  return (
    <main className="bg-background text-foreground min-h-screen">
      <header className="border-border bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-5">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Design System</h1>
            <span className="text-muted-foreground font-mono text-xs">
              {manifest.tokens.length} tokens
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            Generated from <code className="font-mono">app/globals.css</code> — edit a token, it
            ripples everywhere.
          </p>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-12">
        {sections.map((s, i) => (
          <TokenSection key={s.group} section={s} index={i + 1} />
        ))}
        <ComponentShowcase />
      </div>
    </main>
  );
}
