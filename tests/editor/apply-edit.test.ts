import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyEdit } from "@/lib/editor/apply-edit";

const GLOBALS = `:root {
  --primary: oklch(0.205 0 0);
  --z-modal: 1300;
}
.dark {
  --primary: oklch(0.922 0 0);
}
@theme inline { --color-primary: var(--primary); }
`;

let dir: string, file: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ds-")); file = join(dir, "globals.css"); writeFileSync(file, GLOBALS); });

describe("applyEdit", () => {
  it("writes a known token in the light block", async () => {
    await applyEdit(file, { name: "--primary", value: "oklch(0.5 0.2 250)", theme: "light" });
    expect(readFileSync(file, "utf8")).toContain("--primary: oklch(0.5 0.2 250)");
    rmSync(dir, { recursive: true });
  });
  it("writes to the dark block when theme=dark", async () => {
    await applyEdit(file, { name: "--primary", value: "oklch(0.8 0 0)", theme: "dark" });
    const css = readFileSync(file, "utf8");
    expect(css).toMatch(/\.dark \{[^}]*--primary: oklch\(0\.8 0 0\)/s);
    rmSync(dir, { recursive: true });
  });
  it("rejects an unknown token (allowlist) without writing", async () => {
    await expect(applyEdit(file, { name: "--made-up", value: "oklch(0.5 0 0)", theme: "light" }))
      .rejects.toThrow(/unknown token/i);
    expect(readFileSync(file, "utf8")).toBe(GLOBALS);
    rmSync(dir, { recursive: true });
  });
  it("rejects an injection value without writing", async () => {
    await expect(applyEdit(file, { name: "--primary", value: "red; } body{display:none", theme: "light" }))
      .rejects.toThrow();
    expect(readFileSync(file, "utf8")).toBe(GLOBALS);
    rmSync(dir, { recursive: true });
  });
});
