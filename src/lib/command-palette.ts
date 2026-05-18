export const COMMAND_PALETTE_OPEN = "realitymap:command-palette-open";

export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN));
}
