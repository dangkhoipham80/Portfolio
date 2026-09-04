"use client";

/*
 * One body for everyone on the island. The player and the five NPCs are
 * the same dozen boxes in different coats: a figure a little over a unit
 * and a half tall, built facing +z, with hips and shoulders as pivots so
 * the limbs swing from the right place. Which coat is the only difference
 * that matters — the player wears the warm one.
 */

import { BoxGeometry, type Group, SphereGeometry } from "three";

import { useWorld } from "./context";
import type { Token } from "./palette";

const GEO = {
  box: new BoxGeometry(1, 1, 1),
  ball: new SphereGeometry(1, 10, 8),
};

/** The moving parts, for whoever animates them. Kept in the parent's ref. */
export type Limbs = {
  legs: (Group | null)[];
  arms: (Group | null)[];
  torso: Group | null;
};

export function emptyLimbs(): Limbs {
  return { legs: [], arms: [], torso: null };
}

/**
 * Walk cycle: legs and arms swing in opposition, the torso dips a touch
 * on each step. `phase` advances with distance travelled, so a faster walk
 * is a faster cycle and a standing figure is still.
 */
export function pose(limbs: Limbs, phase: number, moving: number, bob: boolean): void {
  const swing = Math.sin(phase) * 0.7 * moving;
  limbs.legs[0]?.rotation.set(swing, 0, 0);
  limbs.legs[1]?.rotation.set(-swing, 0, 0);
  limbs.arms[0]?.rotation.set(-swing * 0.8, 0, 0.08);
  limbs.arms[1]?.rotation.set(swing * 0.8, 0, -0.08);
  limbs.torso?.position.set(0, bob ? Math.abs(Math.sin(phase)) * 0.04 * moving : 0, 0);
}

/**
 * The parent hands in the ref callbacks rather than a ref, so the writes
 * into its `Limbs` happen in its own code — which is where the React
 * Compiler's rules want a ref written.
 */
export function Person({
  coat,
  leg,
  arm,
  torso,
}: {
  coat: Token;
  leg: (index: number, el: Group | null) => void;
  arm: (index: number, el: Group | null) => void;
  torso: (el: Group | null) => void;
}) {
  const { mats } = useWorld();
  return (
    <group>
      {/* Legs, from the hip. */}
      {[-0.11, 0.11].map((x, i) => (
        <group key={i} position={[x, 0.52, 0]} ref={(el) => leg(i, el)}>
          <mesh geometry={GEO.box} material={mats.hair} position-y={-0.26} scale={[0.16, 0.52, 0.17]} castShadow />
        </group>
      ))}
      <group ref={torso}>
        {/* Coat, belt, head, hair. */}
        <mesh geometry={GEO.box} material={mats[coat]} position-y={0.83} scale={[0.44, 0.62, 0.27]} castShadow />
        <mesh geometry={GEO.box} material={mats.hair} position-y={0.55} scale={[0.46, 0.06, 0.29]} />
        <mesh geometry={GEO.ball} material={mats.skin} position-y={1.34} scale={0.2} castShadow />
        <mesh geometry={GEO.box} material={mats.hair} position={[0, 1.47, -0.03]} scale={[0.4, 0.14, 0.4]} />
        {/* Arms, from the shoulder. */}
        {[-0.29, 0.29].map((x, i) => (
          <group key={i} position={[x, 1.08, 0]} ref={(el) => arm(i, el)}>
            <mesh geometry={GEO.box} material={mats[coat]} position-y={-0.22} scale={[0.12, 0.48, 0.13]} castShadow />
            <mesh geometry={GEO.ball} material={mats.skin} position-y={-0.48} scale={0.07} />
          </group>
        ))}
      </group>
    </group>
  );
}
