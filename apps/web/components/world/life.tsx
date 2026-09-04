"use client";

/*
 * Everything on the island that moves by itself: the fox, the birds, the fireflies,
 * the clouds, the chimney smoke, the fire, the lighthouse beam and the pond.
 *
 * All of it runs in `useFrame` against the clock and none of it keeps React
 * state — a state update a frame is a re-render a frame. Under reduced
 * motion (`motion` false in the context) every animation here holds its
 * resting pose: the fox stands, the birds glide, the beam points one way.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  SphereGeometry,
  BoxGeometry,
  PlaneGeometry,
} from "three";

import { seeded, useWorld } from "./context";
import { doorOf, placeById } from "./places";
import { groundHeight } from "./terrain";

const GEO = {
  box: new BoxGeometry(1, 1, 1),
  cone: new ConeGeometry(1, 1, 8),
  ball: new SphereGeometry(1, 10, 7),
  wing: new PlaneGeometry(0.9, 0.28),
  ring: new RingGeometry(0.86, 1, 40),
  beam: new ConeGeometry(1.3, 9, 20, 1, true),
};

/* ------------------------------------------------------------------------ */

/**
 * The fox: the island's companion.
 *
 * Left alone it trots a loop through the meadow between the cabin and the
 * lighthouse. Given a quest it leads: it runs a few paces ahead of the
 * player along the line to the destination, waits when the player falls
 * behind, and moves on when they catch up. Built facing +x; the heading each
 * frame is the direction it is going. The one warm-coloured creature on the
 * island apart from the player — the response light, out for a walk.
 */
export function Fox() {
  const { mats, motion, store, getRuntime } = useWorld();
  const group = useRef<Group>(null);
  const legs = useRef<(Mesh | null)[]>([]);
  const tail = useRef<Mesh>(null);
  // The loop's own clock, advanced only while on the loop, so the fox picks
  // the loop up where it left it rather than jumping to where it would be.
  const loopT = useRef(0.8);
  const heading = useRef(0);
  const pace = useRef(0);

  const LOOP = { cx: 1.6, cz: 2.6, a: 2.6, b: 1.5, speed: 0.32 };

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const state = store.get();
    const runtime = getRuntime();
    const quest = state.mode === "explore" && state.quest ? placeById(state.quest) : null;
    const time = clock.getElapsedTime();
    let moving = 0;

    if (quest) {
      const [dx, dz] = doorOf(quest);
      const p = runtime.player.pos;
      const toDoor = { x: dx - p.x, z: dz - p.z };
      const dist = Math.hypot(toDoor.x, toDoor.z);
      // A few paces ahead of the player, never past the door.
      const lead = Math.min(3.0, dist);
      const ahead =
        dist > 0.01
          ? { x: p.x + (toDoor.x / dist) * lead, z: p.z + (toDoor.z / dist) * lead }
          : { x: dx, z: dz };
      const behind = Math.hypot(g.position.x - p.x, g.position.z - p.z);
      const gap = Math.hypot(ahead.x - g.position.x, ahead.z - g.position.z);
      if (behind < 6 && gap > 0.35) {
        const step = Math.min(gap, 3.4 * dt);
        g.position.x += ((ahead.x - g.position.x) / gap) * step;
        g.position.z += ((ahead.z - g.position.z) / gap) * step;
        heading.current = Math.atan2(-(ahead.z - g.position.z), ahead.x - g.position.x);
        moving = 1;
      } else {
        // Waiting: turn to look back at the player.
        heading.current = Math.atan2(-(p.z - g.position.z), p.x - g.position.x);
      }
    } else {
      const t = loopT.current;
      const lx = LOOP.cx + Math.cos(t) * LOOP.a;
      const lz = LOOP.cz + Math.sin(t) * LOOP.b;
      const gap = Math.hypot(lx - g.position.x, lz - g.position.z);
      if (gap > 0.3) {
        // Back to the loop from wherever the quest left it.
        const step = Math.min(gap, 2.6 * dt);
        g.position.x += ((lx - g.position.x) / gap) * step;
        g.position.z += ((lz - g.position.z) / gap) * step;
        heading.current = Math.atan2(-(lz - g.position.z), lx - g.position.x);
        moving = 1;
      } else if (motion) {
        loopT.current += dt * LOOP.speed;
        g.position.set(lx, 0, lz);
        heading.current = Math.atan2(-Math.cos(t) * LOOP.b, -Math.sin(t) * LOOP.a);
        moving = 1;
      } else {
        g.position.set(lx, 0, lz);
      }
    }

    g.position.y = groundHeight(g.position.x, g.position.z) + 0.02;
    g.rotation.y = heading.current;
    runtime.fox.x = g.position.x;
    runtime.fox.z = g.position.z;

    if (moving) pace.current += dt * 9;
    const swing = moving ? Math.sin(pace.current) * 0.55 : 0;
    if (moving && motion) g.position.y += Math.abs(Math.sin(pace.current)) * 0.05;
    legs.current.forEach((leg, i) => {
      if (leg) leg.rotation.z = i % 2 === 0 ? swing : -swing;
    });
    if (tail.current) tail.current.rotation.z = 0.5 + (motion ? Math.sin(time * 4) * 0.2 : 0);
  });

  return (
    <group ref={group} position={[LOOP.cx + Math.cos(0.8) * LOOP.a, 0, LOOP.cz + Math.sin(0.8) * LOOP.b]} scale={0.9}>
      <mesh geometry={GEO.box} material={mats.fox} position-y={0.36} scale={[0.72, 0.3, 0.3]} castShadow />
      <mesh geometry={GEO.box} material={mats.fox} position={[0.44, 0.5, 0]} scale={[0.3, 0.26, 0.28]} castShadow />
      <mesh geometry={GEO.box} material={mats.snow} position={[0.6, 0.45, 0]} scale={[0.12, 0.12, 0.16]} />
      <mesh geometry={GEO.cone} material={mats.fox} position={[0.4, 0.7, 0.08]} scale={[0.07, 0.16, 0.07]} />
      <mesh geometry={GEO.cone} material={mats.fox} position={[0.4, 0.7, -0.08]} scale={[0.07, 0.16, 0.07]} />
      <mesh ref={tail} geometry={GEO.cone} material={mats.fox} position={[-0.42, 0.4, 0]} rotation-z={0.5} scale={[0.1, 0.4, 0.1]} />
      {[
        [0.24, 0.1],
        [0.24, -0.1],
        [-0.24, 0.1],
        [-0.24, -0.1],
      ].map(([x, z], i) => (
        <mesh
          key={i}
          ref={(el) => {
            legs.current[i] = el;
          }}
          geometry={GEO.box}
          material={mats.trunk}
          position={[x, 0.2, z]}
          scale={[0.08, 0.22, 0.08]}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------------ */

/** Four birds, each on its own circle above the island, wings on the clock. */
export function Birds() {
  const { mats, motion } = useWorld();
  const birds = useMemo(() => {
    const rand = seeded(9);
    return Array.from({ length: 4 }, (_, i) => ({
      r: 5 + rand() * 3,
      h: 6.5 + rand() * 2,
      phase: (i / 4) * Math.PI * 2,
      speed: 0.22 + rand() * 0.08,
      flap: 7 + rand() * 3,
    }));
  }, []);
  const groups = useRef<(Group | null)[]>([]);
  const wings = useRef<(Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const time = motion ? clock.getElapsedTime() : 0;
    birds.forEach((bird, i) => {
      const g = groups.current[i];
      if (!g) return;
      const t = bird.phase + time * bird.speed;
      g.position.set(Math.cos(t) * bird.r, bird.h + Math.sin(time * 0.7 + bird.phase) * 0.3, Math.sin(t) * bird.r);
      g.rotation.y = Math.atan2(-Math.cos(t), -Math.sin(t));
      const flap = motion ? Math.sin(time * bird.flap + bird.phase) * 0.7 : 0.25;
      const left = wings.current[i * 2];
      const right = wings.current[i * 2 + 1];
      if (left) left.rotation.x = flap;
      if (right) right.rotation.x = -flap;
    });
  });

  return (
    <>
      {birds.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          <mesh geometry={GEO.box} material={mats.bird} scale={[0.34, 0.1, 0.1]} />
          <mesh
            ref={(el) => {
              wings.current[i * 2] = el;
            }}
            geometry={GEO.wing}
            material={mats.bird}
            position-z={0.16}
            rotation-x={0}
            scale={[0.5, 1, 1]}
          />
          <mesh
            ref={(el) => {
              wings.current[i * 2 + 1] = el;
            }}
            geometry={GEO.wing}
            material={mats.bird}
            position-z={-0.16}
            scale={[0.5, 1, 1]}
          />
        </group>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * Fireflies, at night only, around the big tree and the pond. One `Points`
 * object with seventy vertices; the positions buffer is rewritten each
 * frame, which is the cheapest way to move seventy things.
 */
export function Fireflies() {
  const { palette, motion } = useWorld();
  const COUNT = 70;
  const { geometry, base, phase } = useMemo(() => {
    const rand = seeded(23);
    const base = new Float32Array(COUNT * 3);
    const phase = new Float32Array(COUNT);
    const homes = [
      { x: -6.2, z: -3.6, r: 3.2 },
      { x: -2.4, z: -6.2, r: 2.2 },
      { x: -1.2, z: 6.6, r: 2.4 },
    ];
    for (let i = 0; i < COUNT; i++) {
      const home = homes[i % homes.length];
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * home.r;
      base[i * 3] = home.x + Math.cos(a) * r;
      base[i * 3 + 1] = 0.4 + rand() * 2.6;
      base[i * 3 + 2] = home.z + Math.sin(a) * r;
      phase[i] = rand() * Math.PI * 2;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(base.slice(), 3));
    return { geometry, base, phase };
  }, []);

  const material = useMemo(
    () =>
      new PointsMaterial({
        color: palette["glow-warm"],
        size: 0.14,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [palette],
  );

  const points = useRef<Points>(null);

  useFrame(({ clock }) => {
    if (!motion || !points.current) return;
    const t = clock.getElapsedTime();
    const attr = points.current.geometry.getAttribute("position") as BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const p = phase[i];
      arr[i * 3] = base[i * 3] + Math.sin(t * 0.5 + p) * 0.4;
      arr[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.8 + p * 2) * 0.25;
      arr[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.45 + p) * 0.4;
    }
    attr.needsUpdate = true;
    (points.current.material as PointsMaterial).opacity = 0.55 + Math.sin(t * 2.2) * 0.35;
  });

  if (!palette.night) return null;
  return <points ref={points} geometry={geometry} material={material} />;
}

/* ------------------------------------------------------------------------ */

/** Three clouds, drifting across and wrapping round. Flat-shaded, translucent. */
export function Clouds() {
  const { palette, motion } = useWorld();
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: palette.cloud,
        flatShading: true,
        transparent: true,
        opacity: palette.night ? 0.55 : 0.92,
        roughness: 1,
      }),
    [palette],
  );
  const clouds = useMemo(() => {
    const rand = seeded(5);
    return Array.from({ length: 3 }, () => ({
      x: -12 + rand() * 24,
      // High enough to clear a camera standing behind the player.
      y: 8.5 + rand() * 2,
      z: -8 + rand() * 12,
      s: 0.8 + rand() * 0.6,
      speed: 0.25 + rand() * 0.2,
    }));
  }, []);
  const groups = useRef<(Group | null)[]>([]);

  useFrame((_, delta) => {
    if (!motion) return;
    clouds.forEach((cloud, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.position.x += delta * cloud.speed;
      if (g.position.x > 16) g.position.x = -16;
    });
  });

  return (
    <>
      {clouds.map((cloud, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
          position={[cloud.x, cloud.y, cloud.z]}
          scale={cloud.s}
        >
          <mesh geometry={GEO.ball} material={material} scale={[1.4, 0.7, 0.9]} />
          <mesh geometry={GEO.ball} material={material} position={[1.1, 0.15, 0.2]} scale={[1, 0.6, 0.7]} />
          <mesh geometry={GEO.ball} material={material} position={[-1.0, 0.05, -0.1]} scale={[0.9, 0.55, 0.7]} />
        </group>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------------ */

/** Puffs from the cabin chimney: rise, swell, fade, repeat. */
export function Smoke({ position }: { position: [number, number, number] }) {
  const { palette, motion } = useWorld();
  const puffs = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        offset: i / 4,
        material: new MeshStandardMaterial({
          color: palette.cloud,
          transparent: true,
          opacity: 0.5,
          roughness: 1,
          flatShading: true,
        }),
      })),
    [palette],
  );
  const meshes = useRef<(Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = motion ? clock.getElapsedTime() * 0.3 : 0.4;
    puffs.forEach((puff, i) => {
      const m = meshes.current[i];
      if (!m) return;
      const life = (t + puff.offset) % 1;
      m.position.set(Math.sin(life * 6 + i) * 0.15, life * 1.8, Math.cos(life * 5) * 0.1);
      const s = 0.12 + life * 0.3;
      m.scale.setScalar(s);
      (m.material as MeshStandardMaterial).opacity = (1 - life) * 0.55;
    });
  });

  return (
    <group position={position}>
      {puffs.map((puff, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          geometry={GEO.ball}
          material={puff.material}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------------ */

/** The campfire's flames and the light they throw, flickering together. */
export function Flames({ position }: { position: [number, number, number] }) {
  const { mats, palette, motion } = useWorld();
  const inner = useRef<Mesh>(null);
  const outer = useRef<Mesh>(null);
  const lightRef = useRef<{ intensity: number } | null>(null);

  useFrame(({ clock }) => {
    const t = motion ? clock.getElapsedTime() : 0;
    const flicker = 1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 7.3) * 0.08;
    if (outer.current) outer.current.scale.set(0.34 * flicker, 0.7 * flicker, 0.34 * flicker);
    if (inner.current) inner.current.scale.set(0.2, 0.45 * (2 - flicker), 0.2);
    if (lightRef.current) lightRef.current.intensity = (palette.night ? 7 : 1.5) * flicker;
  });

  return (
    <group position={position}>
      <mesh ref={outer} geometry={GEO.cone} material={mats["glow-warm"]} position-y={0.3} />
      <mesh ref={inner} geometry={GEO.cone} material={mats.sun} position-y={0.22} />
      <pointLight
        ref={(el) => {
          lightRef.current = el;
        }}
        position-y={0.7}
        color={palette["glow-warm"]}
        distance={6}
        decay={2}
      />
    </group>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * The lighthouse beam: a long open cone, additive, sweeping the island.
 * Faint by day — a lighthouse is still a lighthouse — and bright at night.
 */
export function Beam({ position }: { position: [number, number, number] }) {
  const { palette, motion } = useWorld();
  const group = useRef<Group>(null);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette["glow-cool"],
        transparent: true,
        opacity: palette.night ? 0.16 : 0.05,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [palette],
  );

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = motion ? clock.getElapsedTime() * 0.45 : 2.4;
  });

  return (
    <group ref={group} position={position}>
      {/* Apex at the lamp, base 9 units out, tilted a touch downward. */}
      <mesh geometry={GEO.beam} material={material} position-x={4.5} rotation-z={-Math.PI / 2 - 0.06} />
    </group>
  );
}

/* ------------------------------------------------------------------------ */

/** A ring that grows out from the pond's centre and fades, on a loop. */
export function Ripple({ radius }: { radius: number }) {
  const { palette, motion } = useWorld();
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.snow,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: DoubleSide,
      }),
    [palette],
  );

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const life = motion ? (clock.getElapsedTime() * 0.3) % 1 : 0.5;
    const s = radius * (0.15 + life * 0.85);
    mesh.current.scale.set(s, s, 1);
    (mesh.current.material as MeshBasicMaterial).opacity = (1 - life) * 0.45;
  });

  return <mesh ref={mesh} geometry={GEO.ring} material={material} rotation-x={-Math.PI / 2} position-y={0.01} />;
}
