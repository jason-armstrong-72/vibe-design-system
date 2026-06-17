import { Geist, Geist_Mono } from "next/font/google";

// The shared bundled font set. Themes point --font-sans / --font-mono at these
// via the CSS-var names below. Add serif/display faces here for later themes
// (Editorial, etc.) — keep the set small; every face is download weight.
export const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-bundled-sans",
  display: "swap",
});

export const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-bundled-mono",
  display: "swap",
});

/** className applied to <html> so the --font-bundled-* vars exist globally. */
export const fontVars = `${fontSans.variable} ${fontMono.variable}`;
