import { describe, it, expect } from "vitest";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";

const find = (s: string) => checkHardcodedColor("x.tsx", s).length;

describe("hardcoded-color", () => {
  it("flags a literal hex in a style", () => expect(find(`<div style={{color:'#fff'}}/>`)).toBe(1));
  it("flags rgb()/hsl()", () => expect(find(`const a='rgb(0 0 0)'; const b='hsl(0 0% 0%)';`)).toBe(2));
  it("allows var()-valued inline styles", () => expect(find(`<div style={{background:'var(--primary)'}}/>`)).toBe(0));
  it("does not flag href/url/id anchors", () =>
    expect(find(`<a href="#top"/>; const u='url(#clip)'; const id='#section';`)).toBe(0));
});
