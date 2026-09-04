"use client";

/*
 * The island, as a WebGL scene. Client-only and loaded on demand by
 * world.tsx: this file is the one place `three` is imported for rendering,
 * so the renderer never reaches a page that does not draw the island.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { type Fog, MathUtils, MeshStandardMaterial, Vector3 } from "three";

import { WorldContext } from "./context";
import { Birds, Clouds, Fireflies, Fox } from "./life";
import type { Palette, Token } from "./palette";
import { PLACES, placeById, type PlaceId } from "./places";
import { BigTree, Cabin, Crossroads, Forest, Ground, Lighthouse, Mountain, Path, Pavilion, Pond } from "./scenery";

export type SceneProps = {
  palette: Palette;
  motion: boolean;
  /** Whether to draw frames at all: false when scrolled away or tab hidden. */
  active: boolean;
  hovered: PlaceId | null;
  setHovered: (id: PlaceId | null) => void;
  select: (id: PlaceId) => void;
  /** The place being flown to, if any. `onArrive` fires when the flight lands. */
  flight: PlaceId | null;
  onArrive: () => void;
  /** The signpost elements, by place, for the scene to position each frame. */
  labels: RefObject<Map<PlaceId, HTMLElement>>;
};

/** One material per token. Glow tokens emit; everything else is matte. */
function buildMaterials(palette: Palette): Record<Token, MeshStandardMaterial> {
  const out = {} as Record<Token, MeshStandardMaterial>;
  for (const [token, color] of Object.entries(palette)) {
    if (typeof color !== "object" || !("isColor" in color)) continue;
    const glow = token === "glow-cool" || token === "glow-warm";
    out[token as Token] = new MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: glow ? 1 : 0.92,
      metalness: 0,
      ...(glow ? { emissive: color, emissiveIntensity: palette.night ? 1.6 : 1.1 } : {}),
    });
  }
  return out;
}

/**
 * The camera: an isometric-ish view from the front, idling on a slow swing,
 * leaning with the pointer, and flying down to a place when one is chosen.
 *
 * Orbit maths rather than a controls library: nothing is draggable, so
 * there is nothing to control — the camera only ever does these three
 * things, and OrbitControls would ship a hundred kilobytes to disable
 * most of itself.
 */
function Rig({
  palette,
  motion,
  hovered,
  flight,
  onArrive,
}: Pick<SceneProps, "palette" | "motion" | "hovered" | "flight" | "onArrive">) {
  const { camera, size } = useThree();
  const target = useRef(new Vector3(0, -1.2, 0));
  const state = useRef({ theta: -0.32, phi: 0.66, dist: 32 });
  const flightStart = useRef<number | null>(null);
  const arrived = useRef(false);
  const fog = useRef<Fog>(null);

  useEffect(() => {
    flightStart.current = null;
    arrived.current = false;
  }, [flight]);

  useFrame(({ clock, pointer }, delta) => {
    const t = clock.getElapsedTime();
    const aspect = size.width / Math.max(1, size.height);
    // A phone's portrait viewport needs the camera further back to fit the
    // island's width; a wide screen can come in close.
    const fit = MathUtils.clamp(1.2 / aspect, 1, 1.6);

    let theta = -0.32;
    let phi = 0.66;
    let dist = 32 * fit;
    // Aimed a little below the ground so the island sits above the centre
    // of the frame, clear of the strip of links along the bottom.
    const want = new Vector3(0, -1.2, 0);

    if (motion) {
      theta += Math.sin(t * 0.12) * 0.07;
      theta += pointer.x * 0.08;
      phi -= pointer.y * 0.05;
    }

    if (hovered && !flight) {
      const [x, z] = placeById(hovered).at;
      want.set(x * 0.22, -1.2, z * 0.22);
    }

    if (flight) {
      if (flightStart.current === null) flightStart.current = t;
      const duration = motion ? 0.75 : 0.001;
      const p = MathUtils.clamp((t - flightStart.current) / duration, 0, 1);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const [x, z] = placeById(flight).at;
      want.set(x, 1.4, z);
      dist = MathUtils.lerp(dist, 9, eased);
      phi = MathUtils.lerp(phi, 0.5, eased);
      theta = MathUtils.lerp(theta, Math.atan2(x, z) * 0.35, eased);
      if (p >= 1 && !arrived.current) {
        arrived.current = true;
        onArrive();
      }
    }

    // Everything eases: the pointer lean, the hover glance and the return
    // from either all use the same damping, so nothing snaps.
    const k = motion ? 1 - Math.exp(-delta * (flight ? 9 : 4)) : 1;
    const s = state.current;
    s.theta = MathUtils.lerp(s.theta, theta, k);
    s.phi = MathUtils.lerp(s.phi, phi, k);
    s.dist = MathUtils.lerp(s.dist, dist, k);
    target.current.lerp(want, k);

    camera.position.set(
      target.current.x + Math.sin(s.theta) * Math.cos(s.phi) * s.dist,
      target.current.y + Math.sin(s.phi) * s.dist,
      target.current.z + Math.cos(s.theta) * Math.cos(s.phi) * s.dist,
    );
    camera.lookAt(target.current);

    // The fog band moves with the camera so the island's edge always fades
    // at the same apparent distance whatever the viewport's shape.
    if (fog.current) {
      fog.current.near = s.dist + 6;
      fog.current.far = s.dist + 30;
    }
  });

  // The fog is the sky colour, so the island's edge dissolves into the page.
  return <fog ref={fog} attach="fog" args={[palette.sky, 30, 56]} />;
}

/**
 * Writes each signpost's screen position every frame. DOM, not React: the
 * elements are owned by world.tsx and moved here by `style.transform`, so
 * the labels follow the camera without a render.
 */
function Signposts({ labels }: Pick<SceneProps, "labels">) {
  const { camera, size } = useThree();
  const v = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const map = labels.current;
    if (!map) return;
    for (const place of PLACES) {
      const el = map.get(place.id);
      if (!el) continue;
      v.set(place.at[0], place.labelHeight, place.at[1]).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const visible = v.z < 1;
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.opacity = visible ? "1" : "0";
      el.style.pointerEvents = visible ? "auto" : "none";
    }
  });

  return null;
}

function Island() {
  return (
    <>
      <Ground />
      <Pond />
      <Crossroads />
      {PLACES.map((place, i) => (
        <Path key={place.id} place={place} index={i} />
      ))}
      <Forest />
      <Lighthouse at={placeById("projects").at} />
      <BigTree at={placeById("writing").at} />
      <Mountain at={placeById("career").at} />
      <Pavilion at={placeById("certificates").at} />
      <Cabin at={placeById("contact").at} />
      <Fox />
      <Birds />
      <Clouds />
      <Fireflies />
    </>
  );
}

export default function Scene(props: SceneProps) {
  const { palette, motion, active, hovered, setHovered, select, flight, onArrive, labels } = props;

  const mats = useMemo(() => buildMaterials(palette), [palette]);
  useEffect(() => {
    return () => {
      for (const material of Object.values(mats)) material.dispose();
    };
  }, [mats]);

  const context = useMemo(
    () => ({ palette, mats, motion, hovered, setHovered, select }),
    [palette, mats, motion, hovered, setHovered, select],
  );

  return (
    <Canvas
      // `flat`: no tone mapping, so a token's colour on the island is the
      // colour the stylesheet said, not ACES's idea of it.
      flat
      shadows
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ fov: 36, near: 0.5, far: 140, position: [0, 18, 26] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      onPointerMissed={() => setHovered(null)}
      style={{ position: "absolute", inset: 0 }}
    >
      <WorldContext.Provider value={context}>
        <hemisphereLight args={[palette["sky-light"], palette["ground-light"], palette.night ? 0.9 : 1.1]} />
        <ambientLight intensity={palette.night ? 0.2 : 0.3} />
        <directionalLight
          position={[9, 16, 7]}
          color={palette.sun}
          intensity={palette.sunStrength}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-camera-near={1}
          shadow-camera-far={50}
          shadow-bias={-0.0008}
        />
        <Island />
        <Rig palette={palette} motion={motion} hovered={hovered} flight={flight} onArrive={onArrive} />
        <Signposts labels={labels} />
      </WorldContext.Provider>
    </Canvas>
  );
}
