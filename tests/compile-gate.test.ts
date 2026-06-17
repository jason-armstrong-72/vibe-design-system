import { describe, it, expect } from "vitest";
import { compile } from "@tailwindcss/node";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("app/globals.css"), "utf8");

async function utilitiesFor(classes: string[]): Promise<string> {
  // compile globals.css, then ask Tailwind to generate the given candidate classes.
  // onDependency is REQUIRED — without it compile() throws `TypeError: t is not a function`.
  const compiler = await compile(css, { base: process.cwd(), onDependency: () => {} });
  return compiler.build(classes); // build() is synchronous
}

describe("compile gate", () => {
  it("generates a utility for an in-system token class — resolving to the runtime var", async () => {
    const out = await utilitiesFor(["bg-primary"]);
    // @theme inline resolves the utility THROUGH var(--primary); the namespace
    // name (--color-primary) does NOT appear in output. Assert the real result:
    expect(out).toMatch(/\.bg-primary\s*\{/);
    expect(out).toContain("var(--primary)");
  });

  it("does NOT generate a utility for a cleared default-palette class", async () => {
    const out = await utilitiesFor(["bg-red-500"]);
    expect(out).not.toContain(".bg-red-500"); // selector absent; "red" appears in the license banner
  });
});
