"use client";

/*
 * The world's state, in two tiers.
 *
 * Things React should know about — which panel is open, who is being talked
 * to, what is discovered — live in a tiny external store and are read with
 * `useSyncExternalStore` through a selector, so a component re-renders when
 * its slice changes and not when the player takes a step.
 *
 * Things that change every frame — where the player is, which keys are
 * down, where the camera is looking — live in `Runtime`, plain mutable
 * objects the scene writes and the HUD reads through refs. Nothing per-frame
 * ever goes through React.
 */

import { useSyncExternalStore } from "react";

import type { Dialogue, Interactable } from "./content";
import type { PlaceId } from "./places";

export type Mode = "title" | "explore";
export type CameraMode = "third" | "first";

export type WorldState = {
  mode: Mode;
  camera: CameraMode;
  /** The nearest thing the player could interact with, if any. */
  nearby: Interactable | null;
  /** The open location panel. */
  panel: PlaceId | null;
  dialogue: (Dialogue & { index: number }) | null;
  journal: boolean;
  /** The list view, in place of the scene. */
  atlas: boolean;
  discovered: PlaceId[];
  /** The place the fox is leading to. */
  quest: PlaceId | null;
  /** Whether the player has moved at all: hides the controls hint. */
  moved: boolean;
  /** A landmark under the pointer, for the title view's signposts. */
  hovered: PlaceId | null;
  /** One line of feedback — something found, the fox setting off. */
  toast: string | null;
};

export type Store = {
  get: () => WorldState;
  set: (patch: Partial<WorldState> | ((state: WorldState) => Partial<WorldState>)) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore(initial: WorldState): Store {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      const next = typeof patch === "function" ? patch(state) : patch;
      let changed = false;
      for (const key of Object.keys(next) as (keyof WorldState)[]) {
        if (!Object.is(next[key], state[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...next };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useWorldState<T>(store: Store, selector: (state: WorldState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  );
}

/* ------------------------------------------------------------------------ */

export type Vec2 = { x: number; z: number };

export type Runtime = {
  player: {
    pos: { x: number; y: number; z: number };
    /** Heading, radians. Forward is (sin yaw, cos yaw): 0 faces +z. */
    yaw: number;
    /** Where a click asked the player to walk, if anywhere. */
    target: Vec2 | null;
    /** Ground speed this frame, for the walk cycle. */
    speed: number;
  };
  fox: { x: number; z: number };
  cam: {
    /** Orbit angle around the player in third person; heading in first. */
    yaw: number;
    pitch: number;
  };
  input: {
    keys: Set<string>;
    /** The touch joystick, each axis in [-1, 1]. */
    stick: { x: number; y: number };
  };
  /**
   * DOM elements the scene positions each frame, by id: the signposts, the
   * name tags, the minimap's player dot. Owned by the HUD, moved here.
   */
  anchors: Map<string, Element>;
};

/**
 * Returns a getter rather than the object. Anything React hands out — a
 * prop, a context value, a hook's result — is frozen as far as the React
 * Compiler's rules are concerned, and this object exists to be written to
 * sixty times a second. A function that returns it keeps the writes on the
 * right side of that line: the scene asks for the runtime inside its frame
 * callback and mutates what it was given.
 */
export function createRuntime(): () => Runtime {
  const runtime: Runtime = {
    player: { pos: { x: 0, y: 0, z: 2.4 }, yaw: Math.PI, target: null, speed: 0 },
    fox: { x: 1.6, z: 2.6 },
    cam: { yaw: 0, pitch: 0.5 },
    input: { keys: new Set(), stick: { x: 0, y: 0 } },
    anchors: new Map(),
  };
  return () => runtime;
}

/* ------------------------------------------------------------------------ */

const DISCOVERED_KEY = "world:discovered";
const CAMERA_KEY = "world:camera";

/** What this browser has already found. Empty when storage is unavailable. */
export function loadDiscovered(): PlaceId[] {
  try {
    const raw = window.localStorage.getItem(DISCOVERED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is PlaceId => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function saveDiscovered(ids: PlaceId[]): void {
  try {
    window.localStorage.setItem(DISCOVERED_KEY, JSON.stringify(ids));
  } catch {
    // Storage is a convenience; the journal still works for the session.
  }
}

export function loadCamera(): CameraMode {
  try {
    return window.localStorage.getItem(CAMERA_KEY) === "first" ? "first" : "third";
  } catch {
    return "third";
  }
}

export function saveCamera(mode: CameraMode): void {
  try {
    window.localStorage.setItem(CAMERA_KEY, mode);
  } catch {
    // As above.
  }
}
