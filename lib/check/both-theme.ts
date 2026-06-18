import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseTokens } from "@/lib/tokens/parse";
import { COLOR_ROLES } from "@/lib/tokens/schema";

/** Every semantic color role (COLOR_ROLES) defined in :root must also be in .dark and vice-versa.
 *  Ramps (--brand- and --chart- prefixes) and non-color tokens are intentionally NOT required
 *  in both blocks. */
export function checkBothTheme(globalsCss: string): Finding[] {
  const tokens = parseTokens(globalsCss);
  const light = new Set(tokens.filter((t) => t.theme === "light").map((t) => t.name));
  const dark = new Set(tokens.filter((t) => t.theme === "dark").map((t) => t.name));
  const out: Finding[] = [];
  for (const role of COLOR_ROLES) {
    const name = `--${role}`;
    if (light.has(name) && !dark.has(name))
      out.push({ file: "app/globals.css", line: 0, rule: "both-theme", message: MSG.bothThemeMissing(name, "dark") });
    else if (dark.has(name) && !light.has(name))
      out.push({ file: "app/globals.css", line: 0, rule: "both-theme", message: MSG.bothThemeMissing(name, "light") });
  }
  return out;
}
