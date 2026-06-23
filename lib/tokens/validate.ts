import type { TokenGroup } from "./types";

// Characters that would let a value break out of `--name: value;`
const INJECTION = /[;{}]|\/\*|\*\//;

const LENGTH = /^-?(\d*\.?\d+)(rem|px|em|%)$/;
const CALC = /^calc\(.+\)$/;
const isLength = (v: string) => LENGTH.test(v) || CALC.test(v) || /^var\(--[\w-]+\)$/.test(v);

function checkGroup(group: TokenGroup, v: string): boolean {
  switch (group) {
    case "color":
      return /^(oklch|rgb|rgba|hsl|hsla|color-mix|var)\(.+\)$/.test(v) || /^#[0-9a-fA-F]{3,8}$/.test(v);
    case "fontSize":
    case "lineHeight":
    case "radius":
    case "borderWidth":
    case "spacing":
    case "container":
      return isLength(v);
    case "fontFamily":
      return v.length > 0; // any font stack; injection already screened
    case "fontWeight": {
      const n = Number(v);
      return Number.isInteger(n) && n >= 100 && n <= 900 && n % 100 === 0;
    }
    case "shadow":
    case "gradient":
      return v.length > 0;
    case "duration":
      return /^(\d*\.?\d+)(ms|s)$/.test(v);
    case "easing":
      return /^(cubic-bezier\(.+\)|linear|ease|ease-in|ease-out|ease-in-out|steps\(.+\))$/.test(v);
    case "zIndex": {
      const n = Number(v);
      return Number.isInteger(n);
    }
    case "opacity": {
      const n = Number(v);
      return !Number.isNaN(n) && n >= 0 && n <= 1;
    }
  }
}

/** Throws if `value` is unsafe or wrong-shaped for `group`. */
export function validateValue(group: TokenGroup, value: string): void {
  const v = value.trim();
  if (INJECTION.test(v)) throw new Error(`invalid value (delimiter / injection): ${value}`);
  if (!checkGroup(group, v)) throw new Error(`invalid value for ${group}: ${value}`);
}
