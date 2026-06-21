import { describe, it, expect } from "vitest";
import {
  parseBezier, formatBezier, clampX, clampY, toSvg, fromSvg,
  Y_MIN, Y_MAX, GEOM_DEFAULT, type Cubic,
} from "@/lib/editor/bezier";

describe("parseBezier", () => {
  it("maps each CSS keyword to its exact spec curve", () => {
    expect(parseBezier("linear")).toEqual([0, 0, 1, 1]);
    expect(parseBezier("ease")).toEqual([0.25, 0.1, 0.25, 1]);
    expect(parseBezier("ease-in")).toEqual([0.42, 0, 1, 1]);
    expect(parseBezier("ease-out")).toEqual([0, 0, 0.58, 1]);
    expect(parseBezier("ease-in-out")).toEqual([0.42, 0, 0.58, 1]);
  });
  it("parses cubic-bezier with arbitrary whitespace and negative/overshoot values", () => {
    expect(parseBezier("cubic-bezier(0.2, 0, 0, 1)")).toEqual([0.2, 0, 0, 1]);
    expect(parseBezier("  cubic-bezier(0.68,-0.55,0.27,1.55)  ")).toEqual([0.68, -0.55, 0.27, 1.55]);
  });
  it("returns null for steps(), var(), and garbage", () => {
    expect(parseBezier("steps(4, end)")).toBeNull();
    expect(parseBezier("var(--ease-in)")).toBeNull();
    expect(parseBezier("nonsense")).toBeNull();
    expect(parseBezier("cubic-bezier(1, 2, 3)")).toBeNull();
  });
});

describe("formatBezier", () => {
  it("rounds to 2dp numerically (drops trailing zeros, not toFixed)", () => {
    expect(formatBezier([0.2, 0, 0, 1])).toBe("cubic-bezier(0.2, 0, 0, 1)");
    expect(formatBezier([0.123456, 0.1, 0.999, 1])).toBe("cubic-bezier(0.12, 0.1, 1, 1)");
  });
  it("clamps x defensively into [0,1] on output", () => {
    expect(formatBezier([1.4, 0, -0.3, 1])).toBe("cubic-bezier(1, 0, 0, 1)");
  });
  it("round-trips: parseBezier(formatBezier(c)) === c for normalised c", () => {
    const c: Cubic = [0.2, -0.5, 0.8, 1.5];
    expect(parseBezier(formatBezier(c))).toEqual(c);
  });
  it("the --ease-standard value formats back to its exact globals string (no 0.2->0.20 drift)", () => {
    expect(formatBezier(parseBezier("cubic-bezier(0.2, 0, 0, 1)")!)).toBe("cubic-bezier(0.2, 0, 0, 1)");
  });
});

describe("clamp", () => {
  it("clampX to [0,1], clampY to [Y_MIN,Y_MAX]", () => {
    expect(clampX(-1)).toBe(0);
    expect(clampX(2)).toBe(1);
    expect(clampX(0.5)).toBe(0.5);
    expect(clampY(-99)).toBe(Y_MIN);
    expect(clampY(99)).toBe(Y_MAX);
  });
});

describe("toSvg / fromSvg (coordinate mapping)", () => {
  const g = GEOM_DEFAULT; // {width:240,height:300,padX:24,padTop:90,padBottom:90}
  it("maps anchors to the canvas corners (y flipped: y=0 bottom band, y=1 top band)", () => {
    const s = toSvg([0, 0, 1, 1], g);
    expect(s.p1).toEqual({ sx: 24, sy: 210 });   // x=0 -> padX; y=0 -> height-padBottom
    expect(s.p2).toEqual({ sx: 216, sy: 90 });   // x=1 -> width-padX; y=1 -> padTop
  });
  it("fromSvg inverts toSvg within the [0,1] band", () => {
    const r = fromSvg(24, 210, g);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
  });
  it("fromSvg always clamps x into [0,1] (the value validator won't catch a regression)", () => {
    expect(fromSvg(-500, 150, g).x).toBe(0);
    expect(fromSvg(99999, 150, g).x).toBe(1);
  });
  it("maps the overshoot region (top edge -> Y_MAX, bottom edge -> Y_MIN)", () => {
    expect(fromSvg(120, 0, g).y).toBeCloseTo(Y_MAX);
    expect(fromSvg(120, 300, g).y).toBeCloseTo(Y_MIN);
  });
});
