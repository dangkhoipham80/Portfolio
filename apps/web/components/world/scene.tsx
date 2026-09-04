"use client";

/*
 * The island, as a WebGL scene. Client-only and loaded on demand by
 * world.tsx: this file is the one place `three` is imported for rendering,
 * so the renderer never reaches a page that does not draw the island.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { MeshStandardMaterial, Vector3 } from "three";

import { npcById, type NpcId, type WorldFacts } from "./content";
import { WorldContext } from "./context";
import { Birds, Clouds, Fireflies, Fox } from "./life";
import { People } from "./npcs";
import type { Palette, Token } from "./palette";
import { isPlaceId, LANDMARKS, placeById, type PlaceId } from "./places";
import { Player } from "./player";
import { Rig } from "./rig";
import { Crossroads, Forest, Ground, Landmarks, Path, Pond } from "./scenery";
import type { Runtime, Store } from "./state";
import { groundHeight } from "./terrain";

export type SceneProps = {
  palette: Palette;
  motion: boolean;
  /** Whether to draw frames at all: false when scrolled away or tab hidden. */
  active: boolean;
  store: Store;
  getRuntime: () => Runtime;
  facts: WorldFacts;
  travel: (id: PlaceId) => void;
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
 * Writes each anchored element's screen position every frame. DOM, not
 * React: the elements are owned by the HUD and moved here by
 * `style.transform`, so the signposts and name tags follow the camera
 * without a render. The minimap's player dot is the one anchor that is a
 * map position rather than a projection.
 */
function Anchors({ store, getRuntime }: Pick<SceneProps, "store" | "getRuntime">) {
  const { camera, size } = useThree();
  const v = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const state = store.get();
    const runtime = getRuntime();
    const p = runtime.player;
    for (const [key, el] of runtime.anchors) {
      if (key === "minimap:player") {
        const deg = (Math.atan2(Math.cos(p.yaw), Math.sin(p.yaw)) * 180) / Math.PI;
        el.setAttribute(
          "transform",
          `translate(${(p.pos.x * 4.2).toFixed(1)} ${(p.pos.z * 4.2).toFixed(1)}) rotate(${deg.toFixed(0)})`,
        );
        continue;
      }
      const [kind, id] = key.split(":");
      let fade = 1;
      if (kind === "place" && isPlaceId(id)) {
        const place = placeById(id);
        v.set(place.at[0], place.labelHeight, place.at[1]);
        // Up close the signpost would sit over the top of the screen; it is
        // the prompt's job from here, so it steps back.
        if (state.mode === "explore") {
          const d = Math.hypot(p.pos.x - place.at[0], p.pos.z - place.at[1]);
          fade = Math.min(1, Math.max(0, (d - place.footprint - 1.5) / 2));
        }
      } else if (kind === "npc") {
        const npc = npcById(id as NpcId);
        v.set(npc.at[0], groundHeight(npc.at[0], npc.at[1]) + 1.72, npc.at[1]);
        const d = Math.hypot(p.pos.x - npc.at[0], p.pos.z - npc.at[1]);
        fade = state.mode === "explore" ? Math.min(1, Math.max(0, (11 - d) / 4)) : 0;
      } else {
        continue;
      }
      // Into view space first: a point behind the camera projects to a
      // perfectly plausible spot on screen, mirrored, and only the sign of
      // its depth gives it away.
      v.applyMatrix4(camera.matrixWorldInverse);
      const inFront = v.z < 0;
      v.applyMatrix4(camera.projectionMatrix);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      // Nothing floats over the nameplate in the top-left corner, or over
      // the top edge anywhere.
      const limit = x < 360 ? 175 : 100;
      if (y < limit) fade *= Math.max(0, (y - (limit - 70)) / 70);
      const visible = inFront && fade > 0.01;
      const element = el as HTMLElement;
      element.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      element.style.opacity = visible ? fade.toFixed(2) : "0";
      element.style.pointerEvents = visible ? "auto" : "none";
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
      {LANDMARKS.map((place, i) => (
        <Path key={place.id} place={place} index={i} />
      ))}
      <Forest />
      <Landmarks />
      <People />
      <Player />
      <Fox />
      <Birds />
      <Clouds />
      <Fireflies />
    </>
  );
}

export default function Scene(props: SceneProps) {
  const { palette, motion, active, store, getRuntime, facts, travel } = props;

  const mats = useMemo(() => buildMaterials(palette), [palette]);
  useEffect(() => {
    return () => {
      for (const material of Object.values(mats)) material.dispose();
    };
  }, [mats]);

  const context = useMemo(
    () => ({ palette, mats, motion, store, getRuntime, facts, travel }),
    [palette, mats, motion, store, getRuntime, facts, travel],
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
      camera={{ fov: 36, near: 0.3, far: 140, position: [0, 18, 26] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      onPointerMissed={() => store.set({ hovered: null })}
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
        <Rig />
        <Anchors store={store} getRuntime={getRuntime} />
      </WorldContext.Provider>
    </Canvas>
  );
}
