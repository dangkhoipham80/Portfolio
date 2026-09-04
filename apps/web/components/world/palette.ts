"use client";

/*
 * A client module: it reads the page's computed styles, which only exist in
 * a browser. Nothing here renders.
 */

import { useMemo, useSyncExternalStore } from "react";
import { Color, SRGBColorSpace } from "three";

/**
 * The world's colours, read from `globals.css` rather than written here.
 *
 * The scene has no palette of its own. Every material below reads a
 * `--world-*` token, and those tokens are defined next to the site's other
 * colours in the stylesheet — in the same bare-HSL form — so the island is
 * night in dark mode and day in light mode for the same reason a button is:
 * the theme toggle changed a class on `<html>` and the tokens under it
 * changed with it. A hex in this file would be the one colour on the site
 * the theme could not reach.
 */
const TOKENS = [
  "sky",
  "ground",
  "ground-2",
  "cliff",
  "path",
  "water",
  "leaf",
  "leaf-2",
  "leaf-3",
  "trunk",
  "stone",
  "wall",
  "roof",
  "wood",
  "snow",
  "cloud",
  "fox",
  "bird",
  "sun",
  "sky-light",
  "ground-light",
  "glow-cool",
  "glow-warm",
] as const;

export type Token = (typeof TOKENS)[number];
export type Palette = Record<Token, Color> & {
  /** How bright the sun (or moon) is. Day is ~2, night ~0.6. */
  sun: Color;
  sunStrength: number;
  /** Whether it is night — fireflies come out, the lighthouse beam shows. */
  night: boolean;
};

/** "228 40% 98%" → a Color, interpreted as CSS would: sRGB. */
function colorFrom(channels: string, fallback: Color): Color {
  const match = /^\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*$/.exec(channels);
  if (!match) return fallback;
  return new Color().setHSL(
    Number(match[1]) / 360,
    Number(match[2]) / 100,
    Number(match[3]) / 100,
    SRGBColorSpace,
  );
}

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const night = document.documentElement.classList.contains("dark");
  const grey = new Color(0.5, 0.5, 0.5);

  const entries = Object.fromEntries(
    TOKENS.map((token) => [token, colorFrom(styles.getPropertyValue(`--world-${token}`), grey)]),
  ) as Record<Token, Color>;

  const strength = Number.parseFloat(styles.getPropertyValue("--world-sun-strength"));

  return {
    ...entries,
    sunStrength: Number.isFinite(strength) ? strength : night ? 0.6 : 2,
    night,
  };
}

/**
 * The palette, re-read whenever the theme changes.
 *
 * `null` on the server and before hydration, because the tokens cannot be
 * read until there is a stylesheet to read them from. The theme is
 * subscribed to as an external store — a `MutationObserver` on the root
 * element's class, which is what the toggle changes — so the island hears
 * about a switch without the toggle knowing the island exists. The snapshot
 * is the theme name, a string, so React can tell "unchanged" from "changed"
 * by equality; the palette itself is derived from it once per change.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function themeSnapshot(): "dark" | "light" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function usePalette(): Palette | null {
  const theme = useSyncExternalStore(subscribe, themeSnapshot, () => null);
  return useMemo(() => (theme ? readPalette() : null), [theme]);
}
