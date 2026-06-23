import { describe, it, expect } from "vitest";
import { controlKindForGroup, CONTROL_KINDS } from "@/lib/editor/control-map";
import type { TokenGroup } from "@/lib/tokens/types";

const ALL_GROUPS: TokenGroup[] = [
  "color", "fontFamily", "fontSize", "lineHeight", "fontWeight", "radius",
  "borderWidth", "shadow", "duration", "easing", "spacing", "zIndex", "opacity", "container",
];

describe("control-map", () => {
  it("maps every TokenGroup to a known ControlKind (exhaustive + disjoint)", () => {
    for (const g of ALL_GROUPS) {
      const kind = controlKindForGroup(g);
      expect(CONTROL_KINDS).toContain(kind);
    }
  });
  it("maps the rich editors to their control kinds", () => {
    expect(controlKindForGroup("easing")).toBe("easing");
    expect(controlKindForGroup("shadow")).toBe("shadow");
  });
  it("color/length/select/number/opacity/duration map as specified", () => {
    expect(controlKindForGroup("color")).toBe("color");
    expect(controlKindForGroup("radius")).toBe("length");
    expect(controlKindForGroup("spacing")).toBe("length");
    expect(controlKindForGroup("fontFamily")).toBe("select");
    expect(controlKindForGroup("fontWeight")).toBe("select");
    expect(controlKindForGroup("zIndex")).toBe("number");
    expect(controlKindForGroup("opacity")).toBe("opacity");
    expect(controlKindForGroup("duration")).toBe("duration");
  });
});
