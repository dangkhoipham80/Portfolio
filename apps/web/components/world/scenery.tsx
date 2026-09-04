"use client";

/*
 * The island's furniture: ground, paths, trees, rocks and the five landmarks.
 * Nothing in this file moves — see life.tsx for what does. Client-only for
 * the same reason as the rest of the world: it is WebGL.
 */

import { useMemo } from "react";
import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  BoxGeometry,
  QuadraticBezierCurve3,
  SphereGeometry,
  Vector3,
} from "three";

import { seeded, useWorld } from "./context";
import { Beam, Flames, Ripple, Smoke } from "./life";
import { PLACES, type Place, type PlaceId } from "./places";

/*
 * Geometry is module-level and shared. A geometry is vertex data on the GPU;
 * every pine on the island can point at the same one and differ only in its
 * transform. Creating these inside a component would make forty copies.
 */
const GEO = {
  trunk: new CylinderGeometry(0.09, 0.14, 1, 6),
  pine: new ConeGeometry(0.6, 1.3, 7),
  canopy: new IcosahedronGeometry(0.7, 0),
  rock: new DodecahedronGeometry(0.4, 0),
  stone: new CylinderGeometry(0.34, 0.38, 0.09, 7),
  mound: new SphereGeometry(1, 18, 10),
  box: new BoxGeometry(1, 1, 1),
  cone: new ConeGeometry(1, 1, 16),
  pyramid: new ConeGeometry(1, 1, 4),
  cylinder: new CylinderGeometry(1, 1, 1, 16),
  post: new CylinderGeometry(0.06, 0.06, 1, 6),
  ball: new SphereGeometry(1, 12, 8),
  disc: new CircleGeometry(1, 48),
};

const ISLAND_RADIUS = 11.5;

/* ------------------------------------------------------------------------ */

export function Ground() {
  const { mats } = useWorld();

  // Low mounds, away from the paths, so the island is not a plate.
  const mounds = useMemo(() => {
    const rand = seeded(7);
    const out: { x: number; z: number; r: number; alt: boolean }[] = [];
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
  }, []);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={mats.ground}>
        <circleGeometry args={[ISLAND_RADIUS, 72]} />
      </mesh>
      {/* The cliff face: the island is a thing floating in the page, not a rug. */}
      <mesh position-y={-1.6} material={mats.cliff}>
        <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS * 0.82, 3.2, 72, 1, true]} />
      </mesh>
      {mounds.map((m, i) => (
        <mesh
          key={i}
          geometry={GEO.mound}
          material={m.alt ? mats["ground-2"] : mats.ground}
          position={[m.x, -m.r * 0.72, m.z]}
          scale={[m.r, m.r * 0.9, m.r]}
          receiveShadow
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * A path is stepping stones along a gentle curve from the crossroads out to
 * a place. Stones rather than a ribbon: each is a seven-sided puck, so the
 * path is made of the same low-poly vocabulary as everything else and costs
 * a dozen tiny draws instead of a curved mesh.
 */
export function Path({ place, index }: { place: Place; index: number }) {
  const { mats } = useWorld();

  const stones = useMemo(() => {
    const rand = seeded(100 + index);
    const [x, z] = place.at;
    const end = new Vector3(x, 0, z);
    const length = end.length();
    // Bend the path sideways by a little, alternating direction per path.
    const side = new Vector3(-z, 0, x).normalize().multiplyScalar((index % 2 ? 1 : -1) * length * 0.18);
    const control = end.clone().multiplyScalar(0.5).add(side);
    const curve = new QuadraticBezierCurve3(new Vector3(0, 0, 0), control, end);

    const count = Math.max(6, Math.round(length / 0.85));
    const out: { p: Vector3; rot: number; s: number }[] = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      // Leave the first and last stretch clear: the signpost and the landmark.
      if (t < 0.16 || t > 0.86) continue;
      const p = curve.getPoint(t);
      p.x += (rand() - 0.5) * 0.24;
      p.z += (rand() - 0.5) * 0.24;
      out.push({ p, rot: rand() * Math.PI, s: 0.8 + rand() * 0.4 });
    }
    return out;
  }, [place, index]);

  return (
    <group>
      {stones.map((stone, i) => (
        <mesh
          key={i}
          geometry={GEO.stone}
          material={mats.path}
          position={[stone.p.x, 0.04, stone.p.z]}
          rotation-y={stone.rot}
          scale={[stone.s, 1, stone.s]}
          receiveShadow
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------------ */

function Pine({ scale = 1, variant = 0 }: { scale?: number; variant?: number }) {
  const { mats } = useWorld();
  const leaf = variant === 0 ? mats.leaf : variant === 1 ? mats["leaf-2"] : mats["leaf-3"];
  return (
    <group scale={scale}>
      <mesh geometry={GEO.trunk} material={mats.trunk} position-y={0.5} castShadow />
      <mesh geometry={GEO.pine} material={leaf} position-y={1.3} castShadow />
      <mesh geometry={GEO.pine} material={leaf} position-y={1.95} scale={0.78} castShadow />
      <mesh geometry={GEO.pine} material={leaf} position-y={2.5} scale={0.52} castShadow />
    </group>
  );
}

function RoundTree({ scale = 1, variant = 0 }: { scale?: number; variant?: number }) {
  const { mats } = useWorld();
  const leaf = variant === 0 ? mats.leaf : variant === 1 ? mats["leaf-2"] : mats["leaf-3"];
  return (
    <group scale={scale}>
      <mesh geometry={GEO.trunk} material={mats.trunk} position-y={0.55} scale={[1.1, 1.1, 1.1]} castShadow />
      <mesh geometry={GEO.canopy} material={leaf} position-y={1.5} castShadow />
      <mesh geometry={GEO.canopy} material={leaf} position={[0.35, 1.25, 0.2]} scale={0.7} castShadow />
    </group>
  );
}

/**
 * Trees and rocks, scattered by a seeded PRNG so they never move between
 * renders, and kept clear of the crossroads, the landmarks and the pond.
 */
export function Forest() {
  const { mats } = useWorld();

  const items = useMemo(() => {
    const rand = seeded(42);
    const keepClear: { x: number; z: number; r: number }[] = [
      { x: 0, z: 0, r: 2.6 },
      // The meadow the fox runs in.
      { x: 1.6, z: 2.6, r: 3.2 },
      { x: POND.x, z: POND.z, r: POND.r + 0.8 },
      ...PLACES.map((p) => ({ x: p.at[0], z: p.at[1], r: p.id === "career" ? 3.6 : 2.4 })),
    ];
    const out: { kind: "pine" | "round" | "rock"; x: number; z: number; s: number; v: number; rot: number }[] = [];
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
  }, []);

  return (
    <group>
      {items.map((item, i) =>
        item.kind === "rock" ? (
          <mesh
            key={i}
            geometry={GEO.rock}
            material={mats.stone}
            position={[item.x, 0.18 * item.s, item.z]}
            rotation={[item.rot, item.rot * 0.7, 0]}
            scale={item.s * 0.8}
            castShadow
            receiveShadow
          />
        ) : (
          <group key={i} position={[item.x, 0, item.z]} rotation-y={item.rot}>
            {item.kind === "pine" ? (
              <Pine scale={item.s} variant={item.v} />
            ) : (
              <RoundTree scale={item.s} variant={item.v} />
            )}
          </group>
        ),
      )}
    </group>
  );
}

/* ------------------------------------------------------------------------ */

export const POND = { x: -2.4, z: -6.2, r: 1.7 };

export function Pond() {
  const { mats } = useWorld();
  return (
    <group position={[POND.x, 0.03, POND.z]}>
      <mesh geometry={GEO.disc} material={mats.water} rotation-x={-Math.PI / 2} scale={POND.r} receiveShadow />
      <Ripple radius={POND.r} />
      {/* A rim of stones, so the water has an edge rather than a cut. */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return (
          <mesh
            key={i}
            geometry={GEO.rock}
            material={mats.stone}
            position={[Math.cos(a) * (POND.r + 0.25), 0.1, Math.sin(a) * (POND.r + 0.25)]}
            rotation={[a, a * 2, 0]}
            scale={0.42}
            castShadow
          />
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * The signpost at the crossroads: one arm per place, each pointing at it.
 * The reader stands here; this is what "many paths" looks like in the
 * scene, before the labels say so.
 */
export function Crossroads() {
  const { mats } = useWorld();
  return (
    <group>
      <mesh geometry={GEO.post} material={mats.wood} position-y={1.1} scale={[1.3, 2.2, 1.3]} castShadow />
      {PLACES.map((place, i) => {
        const [x, z] = place.at;
        const angle = Math.atan2(-z, x);
        return (
          <group key={place.id} position-y={2.05 - i * 0.26} rotation-y={angle}>
            <mesh geometry={GEO.box} material={mats.wood} position-x={0.42} scale={[0.86, 0.16, 0.05]} castShadow />
          </group>
        );
      })}
      {/* A ring of stones where the paths meet. */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh
            key={i}
            geometry={GEO.stone}
            material={mats.path}
            position={[Math.cos(a) * 1.5, 0.04, Math.sin(a) * 1.5]}
            rotation-y={a}
            scale={0.7}
            receiveShadow
          />
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * A landmark's interactive wrapper: hover lifts it a touch, click chooses it.
 * `stopPropagation` so the ground under it does not also get the pointer.
 */
export function Landmark({ id, children }: { id: PlaceId; children: React.ReactNode }) {
  const { hovered, setHovered, select } = useWorld();
  const lifted = hovered === id;
  return (
    <group
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(id);
      }}
      onPointerOut={() => setHovered(null)}
      onClick={(event) => {
        event.stopPropagation();
        select(id);
      }}
      scale={lifted ? 1.05 : 1}
    >
      {children}
    </group>
  );
}

/** The lighthouse, on its own hill: selected work, lit by the cool light. */
export function Lighthouse({ at }: { at: [number, number] }) {
  const { mats, palette, hovered } = useWorld();
  const lit = hovered === "projects";
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh geometry={GEO.mound} material={mats["ground-2"]} position-y={-1.9} scale={[2.9, 2.6, 2.9]} receiveShadow />
      <Landmark id="projects">
        <group position-y={0.62}>
          <mesh geometry={GEO.cylinder} material={mats.wall} position-y={1.5} scale={[0.62, 3, 0.62]} castShadow />
          <mesh geometry={GEO.cylinder} material={mats.roof} position-y={1.2} scale={[0.64, 0.5, 0.64]} />
          <mesh geometry={GEO.cylinder} material={mats.roof} position-y={2.3} scale={[0.64, 0.5, 0.64]} />
          <mesh geometry={GEO.cylinder} material={mats.wood} position-y={3.2} scale={[0.5, 0.42, 0.5]} castShadow />
          <mesh geometry={GEO.ball} material={mats["glow-cool"]} position-y={3.6} scale={0.3} />
          <mesh geometry={GEO.cone} material={mats.roof} position-y={4.1} scale={[0.66, 0.6, 0.66]} castShadow />
          <Beam position={[0, 3.6, 0]} />
          <pointLight
            position-y={3.6}
            color={palette["glow-cool"]}
            intensity={(palette.night ? 14 : 3) * (lit ? 1.8 : 1)}
            distance={12}
            decay={2}
          />
        </group>
      </Landmark>
    </group>
  );
}

/** The big tree with a bench and a stack of books under it: the writing. */
export function BigTree({ at }: { at: [number, number] }) {
  const { mats, palette, hovered } = useWorld();
  const lit = hovered === "writing";
  return (
    <group position={[at[0], 0, at[1]]}>
      <Landmark id="writing">
        <mesh geometry={GEO.cylinder} material={mats.trunk} position-y={1.2} scale={[0.36, 2.4, 0.36]} castShadow />
        <mesh geometry={GEO.canopy} material={mats.leaf} position-y={3.2} scale={2.2} castShadow />
        <mesh geometry={GEO.canopy} material={mats["leaf-2"]} position={[1.1, 2.7, 0.6]} scale={1.5} castShadow />
        <mesh geometry={GEO.canopy} material={mats["leaf-3"]} position={[-1.0, 2.9, -0.5]} scale={1.4} castShadow />
        <mesh geometry={GEO.canopy} material={mats.leaf} position={[0.2, 4.2, -0.4]} scale={1.2} castShadow />
        {/* The bench, and what is left on it. */}
        <group position={[1.6, 0, 1.3]} rotation-y={-0.6}>
          <mesh geometry={GEO.box} material={mats.wood} position-y={0.42} scale={[1.3, 0.08, 0.42]} castShadow />
          <mesh geometry={GEO.box} material={mats.wood} position={[-0.5, 0.2, 0]} scale={[0.08, 0.4, 0.38]} />
          <mesh geometry={GEO.box} material={mats.wood} position={[0.5, 0.2, 0]} scale={[0.08, 0.4, 0.38]} />
          <mesh geometry={GEO.box} material={mats.roof} position={[0.25, 0.52, 0]} scale={[0.3, 0.08, 0.22]} />
          <mesh geometry={GEO.box} material={mats.water} position={[0.22, 0.6, 0.02]} scale={[0.26, 0.08, 0.2]} />
          <mesh geometry={GEO.box} material={mats.snow} position={[0.28, 0.68, -0.02]} scale={[0.24, 0.06, 0.18]} />
        </group>
        {/* A paper lantern on the low branch: the warm light, for reading by. */}
        <mesh geometry={GEO.post} material={mats.wood} position={[1.3, 2.35, 0.9]} scale={[0.6, 0.5, 0.6]} />
        <mesh geometry={GEO.ball} material={mats["glow-warm"]} position={[1.3, 2.0, 0.9]} scale={[0.2, 0.26, 0.2]} />
        <pointLight
          position={[1.3, 1.9, 0.9]}
          color={palette["glow-warm"]}
          intensity={(palette.night ? 6 : 1.2) * (lit ? 1.8 : 1)}
          distance={7}
          decay={2}
        />
      </Landmark>
    </group>
  );
}

/** The mountain with a trail and flags at its milestones: the career. */
export function Mountain({ at }: { at: [number, number] }) {
  const { mats } = useWorld();
  const flags = [
    { a: 0.2, h: 1.4, r: 2.3 },
    { a: 1.6, h: 2.7, r: 1.55 },
    { a: 3.1, h: 3.9, r: 0.85 },
  ];
  return (
    <group position={[at[0], 0, at[1]]}>
      <Landmark id="career">
        <mesh geometry={GEO.cone} material={mats.stone} position-y={2.6} scale={[3.3, 5.4, 3.3]} rotation-y={0.4} castShadow receiveShadow />
        <mesh geometry={GEO.cone} material={mats.snow} position-y={4.55} scale={[1.14, 1.5, 1.14]} rotation-y={0.4} />
        <mesh geometry={GEO.cone} material={mats["ground-2"]} position={[2.2, 0.55, 0.8]} scale={[1.6, 1.6, 1.6]} castShadow />
        {/* The trail winds up; each stone a little higher than the last. */}
        {Array.from({ length: 11 }, (_, i) => {
          const t = i / 10;
          const a = -0.6 + t * 3.9;
          const r = 3.05 - t * 2.2;
          return (
            <mesh
              key={i}
              geometry={GEO.stone}
              material={mats.path}
              position={[Math.cos(a) * r, 0.2 + t * 3.9, Math.sin(a) * r]}
              rotation={[0, -a, 0.28]}
              scale={0.55}
            />
          );
        })}
        {flags.map((flag, i) => (
          <group key={i} position={[Math.cos(flag.a) * flag.r, flag.h, Math.sin(flag.a) * flag.r]}>
            <mesh geometry={GEO.post} material={mats.wood} position-y={0.4} scale={[0.5, 0.8, 0.5]} />
            <mesh
              geometry={GEO.box}
              material={i === 2 ? mats["glow-warm"] : mats.roof}
              position={[0.17, 0.66, 0]}
              scale={[0.3, 0.2, 0.03]}
            />
          </group>
        ))}
      </Landmark>
    </group>
  );
}

/** The pavilion with its plinths: the certificates, on display. */
export function Pavilion({ at }: { at: [number, number] }) {
  const { mats } = useWorld();
  const columns = [
    [-1.1, -1.1],
    [1.1, -1.1],
    [-1.1, 1.1],
    [1.1, 1.1],
  ];
  return (
    <group position={[at[0], 0, at[1]]} rotation-y={0.3}>
      <Landmark id="certificates">
        <mesh geometry={GEO.cylinder} material={mats.stone} position-y={0.1} scale={[1.9, 0.2, 1.9]} receiveShadow />
        {columns.map(([x, z], i) => (
          <mesh key={i} geometry={GEO.cylinder} material={mats.wall} position={[x, 1.0, z]} scale={[0.13, 1.6, 0.13]} castShadow />
        ))}
        <mesh geometry={GEO.pyramid} material={mats.roof} position-y={2.3} scale={[2.0, 0.8, 2.0]} rotation-y={Math.PI / 4} castShadow />
        <mesh geometry={GEO.box} material={mats.wall} position-y={1.86} scale={[2.7, 0.12, 2.7]} castShadow />
        {[-0.6, 0, 0.6].map((x, i) => (
          <group key={i} position={[x, 0.2, 0.2]}>
            <mesh geometry={GEO.box} material={mats.wall} position-y={0.3} scale={[0.34, 0.6, 0.34]} castShadow />
            <mesh geometry={GEO.ball} material={mats.sun} position-y={0.75} scale={0.13} />
          </group>
        ))}
      </Landmark>
    </group>
  );
}

/** The cabin, the mailbox and the fire: where a message goes. */
export function Cabin({ at }: { at: [number, number] }) {
  const { mats, palette, hovered } = useWorld();
  const lit = hovered === "contact";
  return (
    <group position={[at[0], 0, at[1]]} rotation-y={-0.5}>
      <Landmark id="contact">
        <mesh geometry={GEO.box} material={mats.wall} position-y={0.7} scale={[1.9, 1.4, 1.6]} castShadow receiveShadow />
        <mesh geometry={GEO.pyramid} material={mats.roof} position-y={1.95} scale={[1.55, 1.1, 1.55]} rotation-y={Math.PI / 4} castShadow />
        <mesh geometry={GEO.box} material={mats.stone} position={[0.5, 2.0, -0.3]} scale={[0.28, 0.8, 0.28]} castShadow />
        <Smoke position={[0.5, 2.45, -0.3]} />
        {/* The door and the lit window face the crossroads. */}
        <mesh geometry={GEO.box} material={mats.wood} position={[-0.45, 0.45, 0.81]} scale={[0.42, 0.9, 0.04]} />
        <mesh geometry={GEO.box} material={mats["glow-warm"]} position={[0.42, 0.8, 0.81]} scale={[0.42, 0.42, 0.04]} />
        <pointLight
          position={[0.42, 0.8, 1.4]}
          color={palette["glow-warm"]}
          intensity={(palette.night ? 8 : 1.5) * (lit ? 1.8 : 1)}
          distance={8}
          decay={2}
        />
        {/* The mailbox, by the path in. */}
        <group position={[-1.5, 0, 1.4]}>
          <mesh geometry={GEO.post} material={mats.wood} position-y={0.45} scale={[1, 0.9, 1]} castShadow />
          <mesh geometry={GEO.box} material={mats.roof} position-y={1.0} scale={[0.5, 0.32, 0.32]} castShadow />
          <mesh geometry={GEO.box} material={mats.sun} position={[0.22, 1.2, 0.1]} scale={[0.06, 0.22, 0.12]} />
        </group>
        {/* The fire: three logs and a light. The flames are in life.tsx. */}
        <group position={[1.7, 0, 1.3]}>
          <Flames position={[0, 0.1, 0]} />
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              geometry={GEO.post}
              material={mats.trunk}
              position-y={0.08}
              rotation={[0, (i / 3) * Math.PI, Math.PI / 2]}
              scale={[1.4, 0.7, 1.4]}
            />
          ))}
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <mesh key={i} geometry={GEO.rock} material={mats.stone} position={[Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5]} scale={0.22} />
            );
          })}
        </group>
      </Landmark>
    </group>
  );
}
