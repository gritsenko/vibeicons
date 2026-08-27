import type { Tweaks } from "../types";

/** Foreground the app paints icons with when the user has expressed no colour
 *  preference — follows the theme so icons stay legible on either background. */
export function themeFg(theme: Tweaks["theme"]): string {
  return theme === "dark" ? "#e6e8ec" : "#1a1d23";
}

/** The two neutral swatches mean "no opinion": picking near-white would
 *  otherwise wash the whole light-theme grid out, and near-black the dark one.
 *  Everything else is a deliberate choice and is applied app-wide. */
const NEUTRAL = new Set(["#f7f7f7", "#1a1d23"]);

/** Icon colour for the browsing surfaces — grid, variations, size previews.
 *  The picked colour wins unless it is one of the neutral swatches, in which
 *  case the theme foreground is used. The detail preview and the exports keep
 *  using the raw picked colour: that is where white-on-dark is the point. */
export function browseColor(color: string, theme: Tweaks["theme"]): string {
  return NEUTRAL.has(color.trim().toLowerCase()) ? themeFg(theme) : color;
}
