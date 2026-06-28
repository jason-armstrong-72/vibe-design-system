// tests/ui/code.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Code, Kbd } from "@/components/ui/code";

describe("Code + Kbd", () => {
  it("Code is a <code> with mono + muted surface", () => {
    const { getByText } = render(<Code>x</Code>);
    const el = getByText("x");
    expect(el.tagName).toBe("CODE");
    expect(el.className).toContain("font-mono");
  });
  it("Kbd uses the 2xs micro step", () => {
    const { getByText } = render(<Kbd>⌘</Kbd>);
    expect(getByText("⌘").className).toContain("text-2xs");
  });
});
