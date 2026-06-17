import type { Token } from "./types";

export interface UtilityHint {
  utilities: string[];
  usage?: string;
}

export function utilitiesForToken(t: Token): UtilityHint {
  const bare = t.name.slice(2);
  switch (t.group) {
    case "color":
      if (bare.endsWith("-foreground")) return { utilities: [`text-${bare}`] };
      // non-paintable semantic colors map to specific utilities, not bg/text/border
      if (bare === "ring") return { utilities: ["ring-ring", "outline-ring"] };
      if (bare === "border") return { utilities: ["border-border"] };
      if (bare === "input") return { utilities: ["border-input"] };
      return { utilities: [`bg-${bare}`, `text-${bare}`, `border-${bare}`] };
    case "fontSize":
      return { utilities: [`text-${bare.replace(/^fs-/, "")}`] };
    case "lineHeight":
      return { utilities: [], usage: `applied with text-${bare.replace(/^lh-/, "")}` };
    case "fontWeight":
      return { utilities: [`font-${bare.replace(/^fw-/, "")}`] };
    case "fontFamily":
      return { utilities: [`font-${bare.replace(/^font-/, "")}`] };
    case "radius":
      return { utilities: ["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"], usage: "--radius is the knob; sm/md/lg/xl derived" };
    case "borderWidth":
      return { utilities: [`border-${bare.replace(/^border-width-/, "")}`] };
    case "shadow":
      return { utilities: [`shadow-${bare.replace(/^elevation-/, "")}`] };
    case "spacing":
      return { utilities: [], usage: "p-<n>/m-<n>/gap-<n> — whole numeric scale derives from --spacing-base" };
    case "zIndex":
      return { utilities: [`z-${bare.replace(/^z-/, "")}`] };
    case "opacity":
      return { utilities: [`opacity-${bare.replace(/^opacity-/, "")}`] };
    case "container":
      return { utilities: [`max-w-${bare.replace(/^container-/, "")}`] };
    case "duration":
      return { utilities: [], usage: `transition-duration via var(${t.name})` };
    case "easing":
      return { utilities: [`ease-${bare.replace(/^ease-/, "")}`] };
    default: {
      // exhaustiveness guard: a new TokenGroup must be handled here, not silently undefined
      const _never: never = t.group;
      throw new Error(`utilitiesForToken: unhandled group ${_never} for ${t.name}`);
    }
  }
}
