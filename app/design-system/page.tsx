import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import { groupedSections } from "@/lib/design-system/sections";
import { TokenSection } from "@/components/design-system/token-section";
import { ComponentShowcase } from "@/components/design-system/component-showcase";
import { EditorMount } from "@/components/editor/editor-mount";

export default function DesignSystemPage() {
  const manifest = designSystem as Manifest;
  const sections = groupedSections(manifest);

  return (
    <EditorMount>
    <main className="bg-muted/40 text-foreground min-h-screen">
      <header className="border-border bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-1 px-6 py-5">
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

      <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10">
        {sections.map((s) => (
          <TokenSection key={s.group} section={s} />
        ))}
        <div className="border-border bg-card flex flex-col gap-6 rounded-xl border p-6 shadow-sm sm:p-8">
          <ComponentShowcase />
        </div>
      </div>
    </main>
    </EditorMount>
  );
}
