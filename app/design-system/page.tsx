import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import { groupedSections } from "@/lib/design-system/sections";
import { TokenSection } from "@/components/design-system/token-section";

export default function DesignSystemPage() {
  const sections = groupedSections(designSystem as Manifest);
  return (
    <main className="bg-background text-foreground flex flex-col gap-12 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">Design System</h1>
        <p className="text-base text-muted-foreground">
          Every token, rendered from <code className="font-mono">app/globals.css</code>. Edit a
          token and it ripples everywhere.
        </p>
      </header>
      {sections.map((s) => (
        <TokenSection key={s.group} section={s} />
      ))}
      {/* component showcase added in Task 4 */}
    </main>
  );
}
