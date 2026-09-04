"use client";

/*
 * The people on the island. Each stands where content.ts puts them and
 * turns to face the player who comes near — the one thing an NPC does that
 * says "you can talk to me" without a marker. Nothing else moves unless
 * motion is allowed, and then only a breath.
 */

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import { NPCS, type Npc } from "./content";
import { useWorld } from "./context";
import { emptyLimbs, Person, pose } from "./person";
import { groundHeight } from "./terrain";

const COAT = { cool: "coat-2", plain: "coat-3" } as const;

function Character({ npc }: { npc: Npc }) {
  const { motion, getRuntime } = useWorld();
  const group = useRef<Group>(null);
  const limbs = useRef(emptyLimbs());
  const yaw = useRef(npc.facing);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const p = getRuntime().player.pos;
    const dx = p.x - npc.at[0];
    const dz = p.z - npc.at[1];
    const near = Math.hypot(dx, dz) < 4.5;
    const want = near ? Math.atan2(dx, dz) : npc.facing;
    let d = want - yaw.current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    yaw.current += motion ? d * Math.min(1, delta * 5) : d;
    g.rotation.y = yaw.current;
    // Breathing: a barely-there rise and fall, offset per person.
    const t = motion ? clock.getElapsedTime() + npc.at[0] : 0;
    pose(limbs.current, 0, 0, false);
    limbs.current.torso?.position.set(0, Math.sin(t * 1.6) * 0.012, 0);
  });

  return (
    <group ref={group} position={[npc.at[0], groundHeight(npc.at[0], npc.at[1]), npc.at[1]]} rotation-y={npc.facing}>
      <Person
        coat={COAT[npc.coat]}
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

export function People() {
  return (
    <>
      {NPCS.map((npc) => (
        <Character key={npc.id} npc={npc} />
      ))}
    </>
  );
}
