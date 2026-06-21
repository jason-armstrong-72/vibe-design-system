import { describe, it, expect } from "vitest";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";

const find = (s: string) => checkHardcodedColor("x.tsx", s).length;

describe("hardcoded-color", () => {
  it("flags a literal hex in a style", () => expect(find(`<div style={{color:'#fff'}}/>`)).toBe(1));
  it("flags rgb()/hsl()", () => expect(find(`const a='rgb(0 0 0)'; const b='hsl(0 0% 0%)';`)).toBe(2));
  it("allows var()-valued inline styles", () => expect(find(`<div style={{background:'var(--primary)'}}/>`)).toBe(0));
  it("does not flag href/url/id anchors", () =>
    expect(find(`<a href="#top"/>; const u='url(#clip)'; const id='#section';`)).toBe(0));

  it("flags inline keyword colors on color-valued property keys", () => {
    expect(find(`<div style={{color:"red"}}/>`)).toBe(1);
    expect(find(`const s={ borderColor: 'blue' };`)).toBe(1);
    expect(find(`const s={ background: "RED" };`)).toBe(1);            // case-insensitive
    expect(find(`const s={ borderTopColor: "red", stopColor: "blue" };`)).toBe(2); // *Color branch
  });
  it("does not false-positive on var()/non-colors/shorthands/identifiers", () => {
    expect(find(`<div style={{borderColor:"var(--foreground)"}}/>`)).toBe(0);
    expect(find(`const s={ boxShadow: shadow };`)).toBe(0);
    expect(find(`const s={ border: "1px solid red" };`)).toBe(0);     // shorthand residual
    expect(find(`const x="decoration-color"; const orange = 1;`)).toBe(0);
    expect(find(`// red is a nice color`)).toBe(0);
  });
  it("flags exactly once per literal (no double-report with hex on same line)", () => {
    expect(find(`const s={ color:"red", background:"#fff" };`)).toBe(2); // 1 keyword + 1 hex
  });
});
