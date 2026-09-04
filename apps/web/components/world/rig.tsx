"use client";

/*
 * The camera, in three states.
 *
 * On the title view it is the island's postcard: an isometric-ish look from
 * the front, idling on a slow swing and leaning with the pointer. Exploring
 * in third person it hangs behind and above the player, orbited by a drag.
 * In first person it is the player's eyes. Every state produces a wanted
 * position and a wanted look-at, and one damping carries the camera between
 * them, which is what makes the swoop from the postcard down to the player
 * a single continuous move rather than a cut.
 *
 * Orbit maths rather than a controls library: nothing is draggable in the
 * library sense, and OrbitControls would ship a hundred kilobytes to
 * disable most of itself.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { type Fog, MathUtils, Vector3 } from "three";

import { useWorld } from "./context";
import { placeById } from "./places";
import { groundHeight } from "./terrain";

const TITLE = { theta: -0.32, phi: 0.66, dist: 32, target: new Vector3(0, -1.2, 0) };
const FOLLOW = { dist: 7.4, height: 1.1 };
const EYE = 1.5;

export function Rig() {
  const { palette, motion, store, getRuntime } = useWorld();
  const { camera, size } = useThree();
  const fog = useRef<Fog>(null);
  const pos = useRef(new Vector3(0, 18, 26));
  const look = useRef(new Vector3(0, -1.2, 0));
  const wantPos = useRef(new Vector3());
  const wantLook = useRef(new Vector3());
  const started = useRef(false);

  useFrame(({ clock, pointer }, delta) => {
    const t = clock.getElapsedTime();
    const state = store.get();
    const runtime = getRuntime();
    const aspect = size.width / Math.max(1, size.height);
    const p = runtime.player.pos;
    const wp = wantPos.current;
    const wl = wantLook.current;
    let stiffness = 4;
    let snap = !motion;

    if (state.mode === "title") {
      // A phone's portrait viewport needs the camera further back to fit
      // the island's width; a wide screen can come in close.
      const fit = MathUtils.clamp(1.2 / aspect, 1, 1.6);
      let theta = TITLE.theta;
      let phi = TITLE.phi;
      const dist = TITLE.dist * fit;
      wl.copy(TITLE.target);
      if (motion) {
        theta += Math.sin(t * 0.12) * 0.07 + pointer.x * 0.08;
        phi -= pointer.y * 0.05;
      }
      if (state.hovered) {
        const [x, z] = placeById(state.hovered).at;
        wl.set(x * 0.22, -1.2, z * 0.22);
      }
      wp.set(
        wl.x + Math.sin(theta) * Math.cos(phi) * dist,
        wl.y + Math.sin(phi) * dist,
        wl.z + Math.cos(theta) * Math.cos(phi) * dist,
      );
    } else if (state.camera === "first") {
      const yaw = runtime.cam.yaw;
      const pitch = (runtime.cam.pitch - 0.5) * 0.8;
      wp.set(p.x, p.y + EYE, p.z);
      wl.set(
        wp.x + Math.sin(yaw) * Math.cos(pitch),
        wp.y - Math.sin(pitch),
        wp.z + Math.cos(yaw) * Math.cos(pitch),
      );
      // Eyes do not lag behind a head.
      stiffness = 30;
      snap = snap || started.current;
    } else {
      const fit = MathUtils.clamp(1.1 / aspect, 1, 1.35);
      const dist = FOLLOW.dist * fit;
      const theta = runtime.cam.yaw;
      const phi = runtime.cam.pitch;
      wl.set(p.x, p.y + FOLLOW.height, p.z);
      wp.set(
        wl.x + Math.sin(theta) * Math.cos(phi) * dist,
        wl.y + Math.sin(phi) * dist,
        wl.z + Math.cos(theta) * Math.cos(phi) * dist,
      );
      // Not through the hill behind the player.
      wp.y = Math.max(wp.y, groundHeight(wp.x, wp.z) + 0.7);
      stiffness = 7;
    }

    const k = snap ? 1 : 1 - Math.exp(-delta * stiffness);
    pos.current.lerp(wp, k);
    look.current.lerp(wl, k);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
    if (state.mode === "explore") started.current = true;
    else started.current = false;

    // The fog band moves with the camera so the island's edge always fades
    // at the same apparent distance whatever the view.
    if (fog.current) {
      const d = pos.current.distanceTo(look.current);
      fog.current.near = state.mode === "title" ? d + 6 : 18;
      fog.current.far = state.mode === "title" ? d + 30 : 46;
    }
  });

  // The fog is the sky colour, so the island's edge dissolves into the page.
  return <fog ref={fog} attach="fog" args={[palette.sky, 30, 56]} />;
}
