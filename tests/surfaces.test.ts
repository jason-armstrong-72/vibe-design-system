import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(p), "utf8");
const POINTERS = [".cursor/rules/design-system.mdc", ".github/copilot-instructions.md"];
const TABLE_HEADER = "| Token | Group | Value"; // substring of the design-system.md table header
const NO_INLINE = [...POINTERS, "GEMINI.md"];

describe("portable rules surface", () => {
  it("all auto-load surfaces exist", () => {
    for (const f of ["CLAUDE.md", "GEMINI.md", ".cursor/rules/design-system.mdc", ".github/copilot-instructions.md"])
      expect(existsSync(resolve(f)), `${f} missing`).toBe(true);
  });

  it("GEMINI.md imports the canonical AGENTS.md (mirrors CLAUDE.md)", () => {
    expect(read("GEMINI.md")).toContain("@AGENTS.md");
  });

  it("each pointer surface references both AGENTS.md and design-system.md", () => {
    for (const f of POINTERS) {
      const c = read(f);
      expect(c, `${f} should point to AGENTS.md`).toContain("AGENTS.md");
      expect(c, `${f} should point to design-system.md`).toContain("design-system.md");
    }
  });

  it("no pointer surface inlines the contract (single source of truth)", () => {
    for (const f of NO_INLINE) {
      const c = read(f);
      expect(c, `${f} must not inline the token table`).not.toContain(TABLE_HEADER);
      expect(c, `${f} must not inline the design-system block`).not.toContain("BEGIN:design-system");
    }
  });

  it("README points any-tool users at the contract and isn't stale", () => {
    const r = read("README.md");
    expect(r).toContain("AGENTS.md");
    expect(r).toContain("design-system.md");
    expect(r, "stale 'In progress' Status block must be replaced").not.toContain("In progress");
    expect(r, "README should point to the live status doc").toContain("docs/HANDOFF.md");
  });

  it("AGENTS.md carries the brownfield baseline directive inside the design-system block", () => {
    const a = read("AGENTS.md");
    expect(a).toContain("check:baseline");
    expect(a).toContain("one-time human adoption step");
  });

  it("README documents brownfield adoption", () => {
    expect(read("README.md")).toContain("check:baseline");
  });
});
