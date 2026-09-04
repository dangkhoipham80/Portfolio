"use client";

import { createContext, useContext } from "react";
import type { MeshStandardMaterial } from "three";

import type { Palette, Token } from "./palette";
import type { PlaceId } from "./places";

/**
 * What every piece of the island needs and none should fetch for itself:
 * the palette, one shared material per token, and the interaction state.
 *
 * Materials are shared on purpose. Forty trees with forty materials is forty
 * uniform uploads a frame for one colour; one material per token is a
 * handful, and it is also what keeps the world one system — there is no way
 * for a tree to be a slightly different green from the next tree.
 */
export type WorldContextValue = {
  palette: Palette;
  mats: Record<Token, MeshStandardMaterial>;
  /** False under `prefers-reduced-motion`: nothing idles, drifts or flaps. */
  motion: boolean;
  hovered: PlaceId | null;
  setHovered: (id: PlaceId | null) => void;
  /** A place was chosen: fly to it, then go there. */
  select: (id: PlaceId) => void;
};

export const WorldContext = createContext<WorldContextValue | null>(null);

export function useWorld(): WorldContextValue {
  const value = useContext(WorldContext);
  if (!value) throw new Error("useWorld outside <WorldContext>");
  return value;
}

/** A small deterministic PRNG, so the trees stand where they stood last render. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
