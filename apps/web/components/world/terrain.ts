/*
 * The lie of the land: where the hills, trees, rocks and solid things are.
 *
 * Computed once at module level from seeded PRNGs and imported by both the
 * renderer (scenery.tsx) and the player (player.tsx), so what is drawn and
 * what is walked around are the same list by construction. No `three`
 * import and no React: numbers only.
 */

import { seeded } from "./context";
import { NPCS, POIS } from "./content";
import { doorOf, PLACES } from "./places";

export const ISLAND_RADIUS = 11.5;

/** How far from the centre the player may walk: short of the cliff. */
export const WALK_RADIUS = ISLAND_RADIUS - 0.9;

export const POND = { x: -2.4, z: -6.2, r: 1.7 };

/* ------------------------------------------------------------------------ */

type Mound = { x: number; z: number; r: number; alt: boolean };

/** Low mounds, away from the paths, so the island is not a plate. */
export const MOUNDS: Mound[] = (() => {
  const rand = seeded(7);
  const out: Mound[] = [];
  for (let i = 0; i < 9; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 4 + rand() * 6;
    out.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      r: 1.6 + rand() * 1.8,
      alt: rand() > 0.5,
    });
  }
  return out;
})();

/**
 * The height of the ground at a point: the top of whichever mound is there,
 * or zero. The player walks over the hills rather than through them, and
 * the camera follows.
 */
export function groundHeight(x: number, z: number): number {
  let y = 0;
  for (const m of MOUNDS) {
    const d2 = (x - m.x) ** 2 + (z - m.z) ** 2;
    const r2 = m.r * m.r;
    if (d2 >= r2) continue;
    // A sphere of radius r, squashed to 0.9r tall, sunk to 0.72r below ground.
    const top = -0.72 * m.r + 0.9 * m.r * Math.sqrt(1 - d2 / r2);
    if (top > y) y = top;
  }
  return y;
}

type ForestItem = { kind: "pine" | "round" | "rock"; x: number; z: number; s: number; v: number; rot: number };

/**
 * Trees and rocks, scattered by a seeded PRNG so they never move between
 * renders, and kept clear of the crossroads, the landmarks, the pond, the
 * people and the doors they stand at.
 */
export const FOREST: ForestItem[] = (() => {
  const rand = seeded(42);
  const keepClear: { x: number; z: number; r: number }[] = [
    { x: 0, z: 0, r: 3.0 },
    // The meadow the fox runs in.
    { x: 1.6, z: 2.6, r: 3.2 },
    { x: POND.x, z: POND.z, r: POND.r + 0.8 },
    ...PLACES.map((p) => ({ x: p.at[0], z: p.at[1], r: p.footprint + 1.0 })),
    ...PLACES.map((p) => {
      const [x, z] = doorOf(p);
      return { x, z, r: 1.4 };
    }),
    ...NPCS.map((n) => ({ x: n.at[0], z: n.at[1], r: 1.3 })),
    ...POIS.map((p) => ({ x: p.at[0], z: p.at[1], r: 1.2 })),
  ];
  const out: ForestItem[] = [];
  let tries = 0;
  while (out.length < 46 && tries < 600) {
    tries++;
    const angle = rand() * Math.PI * 2;
    const radius = 2.4 + Math.sqrt(rand()) * (ISLAND_RADIUS - 3.2);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (keepClear.some((c) => Math.hypot(c.x - x, c.z - z) < c.r)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 1.1)) continue;
    const roll = rand();
    out.push({
      kind: roll < 0.55 ? "pine" : roll < 0.82 ? "round" : "rock",
      x,
      z,
      s: 0.7 + rand() * 0.7,
      v: Math.floor(rand() * 3),
      rot: rand() * Math.PI * 2,
    });
  }
  return out;
})();

export type Obstacle = { x: number; z: number; r: number };

/**
 * Everything solid, as circles on the ground. The player slides around
 * these; see player.tsx. Landmarks use their footprint, trees their trunk,
 * people a little personal space.
 */
export const OBSTACLES: Obstacle[] = [
  ...PLACES.map((p) => ({ x: p.at[0], z: p.at[1], r: p.footprint })),
  { x: POND.x, z: POND.z, r: POND.r + 0.25 },
  ...FOREST.map((f) => ({ x: f.x, z: f.z, r: f.kind === "rock" ? 0.42 * f.s : 0.3 * f.s })),
  ...NPCS.map((n) => ({ x: n.at[0], z: n.at[1], r: 0.55 })),
  // The bench, the mailbox and the campfire.
  { x: -4.6, z: -2.3, r: 0.7 },
  { x: -3.2, z: 7.1, r: 0.4 },
  { x: -0.3, z: 8.5, r: 0.7 },
];

