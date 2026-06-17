import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { writeToken } from "@/lib/tokens/write";
import { parseTokens } from "@/lib/tokens/parse";

const FIXTURE = resolve("tests/tokens/fixtures/sample.css");
let file: string;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "ds-write-"));
  file = join(dir, "globals.css");
  copyFileSync(FIXTURE, file);
});

describe("writeToken", () => {
  it("updates exactly one declaration in :root", async () => {
    await writeToken(file, { name: "--primary", value: "oklch(0.5 0.1 250)", theme: "light" });
    const tokens = parseTokens(readFileSync(file, "utf8"));
    expect(tokens.find((t) => t.name === "--primary" && t.theme === "light")?.value)
      .toBe("oklch(0.5 0.1 250)");
    expect(tokens.find((t) => t.name === "--primary" && t.theme === "dark")?.value)
      .toBe("oklch(0.922 0 0)");
  });

  it("writes to the .dark block when theme=dark", async () => {
    await writeToken(file, { name: "--primary", value: "oklch(0.8 0 0)", theme: "dark" });
    const tokens = parseTokens(readFileSync(file, "utf8"));
    expect(tokens.find((t) => t.name === "--primary" && t.theme === "dark")?.value)
      .toBe("oklch(0.8 0 0)");
  });

  it("preserves comments and surrounding declarations", async () => {
    await writeToken(file, { name: "--primary", value: "oklch(0.5 0.1 250)", theme: "light" });
    const out = readFileSync(file, "utf8");
    expect(out).toContain("/* trailing comment kept */");
    expect(out).toContain("/* color: semantic */");
    expect(out).toContain("--background: oklch(1 0 0);");
  });

  it("never writes into the @theme inline block", async () => {
    await writeToken(file, { name: "--spacing-base", value: "0.3rem", theme: "light" });
    const out = readFileSync(file, "utf8");
    expect(out).toContain("--spacing: var(--spacing-base);"); // @theme line intact
    expect(out).toContain("--spacing-base: 0.3rem;");
  });

  it("rejects a convention-valid token absent from the file (no creation via editor)", async () => {
    // --warning is a valid color role but is not in the fixture
    await expect(
      writeToken(file, { name: "--warning", value: "oklch(0.8 0.16 80)", theme: "light" }),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects a name outside the naming convention (non-color value can't be inferred)", async () => {
    await expect(
      writeToken(file, { name: "--does-not-exist", value: "1rem", theme: "light" }),
    ).rejects.toThrow(/unknown token/i);
  });

  it("accepts a user-added color token (unknown name, color value) and writes it", async () => {
    // simulate the extension path: a new color already added to the file
    const css = readFileSync(file, "utf8").replace(
      "--success: oklch(0.62 0.17 145);",
      "--success: oklch(0.62 0.17 145);\n  --highlight: oklch(0.7 0.2 320);",
    );
    writeFileSync(file, css);
    await writeToken(file, { name: "--highlight", value: "oklch(0.6 0.2 320)", theme: "light" });
    const tokens = parseTokens(readFileSync(file, "utf8"));
    expect(tokens.find((t) => t.name === "--highlight")?.group).toBe("color");
    expect(tokens.find((t) => t.name === "--highlight")?.value).toBe("oklch(0.6 0.2 320)");
  });

  it("rejects an injection value before touching the file", async () => {
    const before = readFileSync(file, "utf8");
    await expect(
      writeToken(file, { name: "--primary", value: "red; } body{", theme: "light" }),
    ).rejects.toThrow(/invalid/i);
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("picks up an external edit (re-reads before writing)", async () => {
    const edited = readFileSync(file, "utf8").replace(
      "--background: oklch(1 0 0);",
      "--background: oklch(1 0 0);\n  --accent: oklch(0.97 0 0);",
    );
    writeFileSync(file, edited);
    await writeToken(file, { name: "--accent", value: "oklch(0.5 0 0)", theme: "light" });
    const tokens = parseTokens(readFileSync(file, "utf8"));
    expect(tokens.find((t) => t.name === "--accent")?.value).toBe("oklch(0.5 0 0)");
  });
});
