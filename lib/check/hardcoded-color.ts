import type { Finding } from "./types";
import { MSG } from "./messages";

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNC = /\b(rgb|rgba|hsl|hsla)\(/g;
const EXEMPT = /(href=|url\(|id=)/; // anchors, svg url refs, id strings

/** Flag literal color values (#hex, rgb(/hsl() in source. Exempt var()-valued styles + href/url/id.
 *  Non-color "#" anchors (e.g. "#top", "#section", url(#clip)) are not valid hex, so the HEX regex
 *  already ignores them; EXEMPT additionally drops anchor/url/id lines outright.
 *  Path-level exclusions (token sources, components/ui, editor-chrome.css) are applied by run.ts. */
export function checkHardcodedColor(path: string, content: string): Finding[] {
  const out: Finding[] = [];
  content.split("\n").forEach((ln, i) => {
    if (EXEMPT.test(ln)) return;
    for (const hex of ln.matchAll(HEX))
      out.push({ file: path, line: i + 1, rule: "hardcoded-color", message: MSG.hardcodedColor(hex[0]) });
    for (const fn of ln.matchAll(FUNC))
      out.push({ file: path, line: i + 1, rule: "hardcoded-color", message: MSG.hardcodedColor(fn[0]) });
  });
  return out;
}
