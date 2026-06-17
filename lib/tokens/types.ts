export type Theme = "light" | "dark"; // :root = light, .dark = dark

export type TokenGroup =
  | "color"
  | "fontFamily"
  | "fontSize"
  | "lineHeight"
  | "fontWeight"
  | "radius"
  | "borderWidth"
  | "shadow"
  | "duration"
  | "easing"
  | "spacing"
  | "zIndex"
  | "opacity"
  | "container";

export type ControlType =
  | "color"
  | "select"
  | "length-slider"
  | "duration-slider"
  | "easing"
  | "number"
  | "opacity-slider"
  | "text";

export interface Token {
  name: string;   // e.g. "--primary"
  value: string;  // e.g. "oklch(0.205 0 0)"
  theme: Theme;
  group: TokenGroup;
}

export interface TokenEdit {
  name: string;
  value: string;
  theme: Theme;
}
