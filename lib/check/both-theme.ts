import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseTokens } from "@/lib/tokens/parse";
import { isColorValue } from "@/lib/tokens/schema";

const isRamp = (name: string) => /^--(brand|chart)-/.test(name);

/** Every color-valued token (by value, ramps exempt) defined in :root must also be in .dark and
 *  vice-versa. Ramps (--brand-/--chart-) are intentionally allowed in one block; non-color tokens
 *  are exempt. */
export function checkBothTheme(globalsCss: string): Finding[] {
  const tokens = parseTokens(globalsCss);
  const valueOf = (name: string) =>
    tokens.find((t) => t.name === name && t.theme === "light")?.value ??
    tokens.find((t) => t.name === name && t.theme === "dark")?.value;
  const light = new Set(tokens.filter((t) => t.theme === "light").map((t) => t.name));
  const dark = new Set(tokens.filter((t) => t.theme === "dark").map((t) => t.name));
  const colorNames = [...new Set([...light, ...dark])].filter(
    (n) => !isRamp(n) && isColorValue(valueOf(n) ?? ""),
  );
  const out: Finding[] = [];
  for (const name of colorNames) {
    if (light.has(name) && !dark.has(name))
      out.push({ file: "app/globals.css", line: 0, rule: "both-theme", message: MSG.bothThemeMissing(name, "dark") });
    else if (dark.has(name) && !light.has(name))
      out.push({ file: "app/globals.css", line: 0, rule: "both-theme", message: MSG.bothThemeMissing(name, "light") });
  }
  return out;
}
