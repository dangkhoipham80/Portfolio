"use client";

/*
 * The player: a figure in the warm coat, and the code that moves it.
 *
 * Everything here runs in `useFrame` against the runtime and writes back
 * to it; React only hears about it when something a component needs to
 * know changes — the nearest interactable, or that the player has moved
 * for the first time. Movement comes from three sources, in priority
 * order: held keys, the touch joystick, and a point the player clicked.
 */

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import { useWorld } from "./context";
import { interactableKey, NPCS, POIS, type Interactable } from "./content";
import { PLACES } from "./places";
import { emptyLimbs, Person, pose } from "./person";
import { groundHeight, OBSTACLES, WALK_RADIUS } from "./terrain";

const WALK = 3.4;
const RUN = 5.4;
/** How fast the figure turns to face where it is going, per second. */
const TURN = 11;
/** How fast the first-person view turns with A/D, radians per second. */
const LOOK_TURN = 2.2;

function dampAngle(from: number, to: number, k: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, k);
}

/** Push a point out of every obstacle it is inside, and back inside the cliff. */
function resolve(pos: { x: number; z: number }, radius: number): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of OBSTACLES) {
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + radius;
      if (d >= min || d < 1e-4) continue;
      pos.x = o.x + (dx / d) * min;
      pos.z = o.z + (dz / d) * min;
    }
  }
  const r = Math.hypot(pos.x, pos.z);
  if (r > WALK_RADIUS) {
    pos.x = (pos.x / r) * WALK_RADIUS;
    pos.z = (pos.z / r) * WALK_RADIUS;
  }
}

/**
 * The nearest thing the player could interact with. Places are reachable
 * from outside their footprint; people and points of interest from a pace
 * or two away. The fox is wherever it is now.
 */
function findNearby(x: number, z: number, fox: { x: number; z: number }): Interactable | null {
  let best: Interactable | null = null;
  let bestScore = Infinity;

  for (const place of PLACES) {
    const d = Math.hypot(x - place.at[0], z - place.at[1]) - place.footprint;
    if (d < place.reach && d < bestScore) {
      bestScore = d;
      best = { kind: "place", id: place.id };
    }
  }
  for (const npc of NPCS) {
    const d = Math.hypot(x - npc.at[0], z - npc.at[1]);
    // People take precedence over the place they stand near: closer is a
    // conversation, and the panel is one line further into it.
    if (d < 2.0 && d - 0.6 < bestScore) {
      bestScore = d - 0.6;
      best = { kind: "npc", id: npc.id };
    }
  }
  for (const poi of POIS) {
    const at = poi.id === "fox" ? [fox.x, fox.z] : poi.at;
    const d = Math.hypot(x - at[0], z - at[1]);
    if (d < poi.reach && d - 0.3 < bestScore) {
      bestScore = d - 0.3;
      best = { kind: "poi", id: poi.id };
    }
  }
  return best;
}

export function Player() {
  const { motion, store, getRuntime } = useWorld();
  const group = useRef<Group>(null);
  const limbs = useRef(emptyLimbs());
  const phase = useRef(0);
  const nearbyKey = useRef<string | null>(null);
  const spawn = getRuntime().player;

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const state = store.get();
    const runtime = getRuntime();
    const p = runtime.player;
    const { keys, stick } = runtime.input;
    // The player moves only while exploring with nothing open over the
    // island — a panel, a conversation, the journal.
    const free = state.mode === "explore" && !state.panel && !state.dialogue && !state.journal;
    const first = state.camera === "first";

    let ix = 0;
    let iz = 0;
    if (free) {
      if (keys.has("w") || keys.has("arrowup")) iz -= 1;
      if (keys.has("s") || keys.has("arrowdown")) iz += 1;
      if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
      if (keys.has("d") || keys.has("arrowright")) ix += 1;
      ix += stick.x;
      iz += stick.y;
    }

    let mx = 0;
    let mz = 0;
    const input = Math.hypot(ix, iz);
    if (input > 0.05) {
      p.target = null;
      const scale = Math.min(1, input) / input;
      if (first) {
        // In first person the horizontal axis turns rather than strafes:
        // the view is the heading, and A/D swing it.
        p.yaw -= ix * scale * LOOK_TURN * dt;
        runtime.cam.yaw = p.yaw;
        mx = Math.sin(p.yaw) * -iz * scale;
        mz = Math.cos(p.yaw) * -iz * scale;
      } else {
        // Relative to the camera: W is away from it, D is screen-right.
        const theta = runtime.cam.yaw;
        const fx = -Math.sin(theta);
        const fz = -Math.cos(theta);
        const rx = Math.cos(theta);
        const rz = -Math.sin(theta);
        mx = (fx * -iz + rx * ix) * scale;
        mz = (fz * -iz + rz * ix) * scale;
      }
    } else if (free && p.target) {
      const dx = p.target.x - p.pos.x;
      const dz = p.target.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.25) {
        p.target = null;
      } else {
        // Ease into the last half-unit rather than overshooting it.
        const s = Math.min(1, d / 0.6);
        mx = (dx / d) * s;
        mz = (dz / d) * s;
      }
    }

    const moving = Math.hypot(mx, mz);
    const speed = keys.has("shift") ? RUN : WALK;
    if (moving > 0.001) {
      const before = { x: p.pos.x, z: p.pos.z };
      p.pos.x += mx * speed * dt;
      p.pos.z += mz * speed * dt;
      resolve(p.pos, 0.3);
      // Stuck against something: a click target on the far side of a wall
      // would otherwise keep the walk cycle going forever.
      if (p.target && Math.hypot(p.pos.x - before.x, p.pos.z - before.z) < 0.002) p.target = null;
      if (!first) {
        const want = Math.atan2(mx, mz);
        p.yaw = motion ? dampAngle(p.yaw, want, TURN * dt) : want;
      }
      if (!state.moved) store.set({ moved: true });
    }
    p.speed = moving * speed;
    p.pos.y = groundHeight(p.pos.x, p.pos.z);

    g.position.set(p.pos.x, p.pos.y, p.pos.z);
    g.rotation.y = p.yaw;
    // In first person the camera is inside the head; the body would be a
    // wall of coat.
    g.visible = !(first && state.mode === "explore");

    phase.current += p.speed * dt * 2.4;
    pose(limbs.current, phase.current, Math.min(1, moving), motion);

    // What is in reach, reported only when it changes.
    const near = state.mode === "explore" ? findNearby(p.pos.x, p.pos.z, runtime.fox) : null;
    const key = near ? interactableKey(near) : null;
    if (key !== nearbyKey.current) {
      nearbyKey.current = key;
      store.set({ nearby: near });
    }
  });

  return (
    <group ref={group} position={[spawn.pos.x, 0, spawn.pos.z]} rotation-y={spawn.yaw}>
      <Person
        coat="coat"
        leg={(i, el) => {
          limbs.current.legs[i] = el;
        }}
        arm={(i, el) => {
          limbs.current.arms[i] = el;
        }}
        torso={(el) => {
          limbs.current.torso = el;
        }}
      />
    </group>
  );
}
