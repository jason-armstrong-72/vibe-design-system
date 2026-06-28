// tests/ui/button-hover.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("button hover uses the accent surface", () => {
  it("outline + ghost variants hover to bg-accent", () => {
    const { getByText } = render(<><Button variant="outline">O</Button><Button variant="ghost">G</Button></>);
    expect(getByText("O").className).toContain("hover:bg-accent");
    expect(getByText("G").className).toContain("hover:bg-accent");
  });
});
