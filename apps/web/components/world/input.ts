"use client";

/*
 * Keys and pointer drags, written into the runtime for the scene to read.
 *
 * Nothing here decides what a key does — it only records that it is down.
 * The player component turns the set of keys into movement each frame, and
 * the world component turns a press of E into an interaction. Keeping the
 * two apart means the HUD's buttons and the keyboard drive the same code.
 */

import { useEffect, type RefObject } from "react";

import type { Runtime } from "./state";

export const MOVE_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "shift",
]);

/** Keys that mean "do the thing in front of me". */
export const INTERACT_KEYS = new Set(["e", "enter", " "]);

/** Whether the keystroke belongs to a text field, not to the island. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Tracks which movement keys are held. Only while `enabled` — the title view
 * and an open panel do not move the player — and never while typing into a
 * field, which matters because the contact form lives inside a panel.
 */
export function useMovementKeys(getRuntime: () => Runtime, enabled: boolean): void {
  useEffect(() => {
    const runtime = getRuntime();
    const keys = runtime.input.keys;
    if (!enabled) {
      keys.clear();
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (!MOVE_KEYS.has(key)) return;
      // Arrow keys scroll the page and space pages it; while the island is
      // taking them, the page must not.
      if (key.startsWith("arrow")) event.preventDefault();
      keys.add(key);
      // A key press cancels a click-to-walk: the keyboard is the more
      // deliberate of the two.
      runtime.player.target = null;
    }

    function onKeyUp(event: KeyboardEvent) {
      keys.delete(event.key.toLowerCase());
    }

    // Losing the window mid-keypress would leave a key stuck down.
    function onBlur() {
      keys.clear();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      keys.clear();
    };
  }, [getRuntime, enabled]);
}

/**
 * Drag to look. A press that moves less than a few pixels is a tap, and the
 * scene's own click handling takes it; anything further is an orbit. Touch
 * and mouse alike, through pointer events.
 */
export function useDragToLook(
  root: RefObject<HTMLElement | null>,
  getRuntime: () => Runtime,
  enabled: boolean,
): void {
  useEffect(() => {
    const el = root.current;
    if (!el || !enabled) return;
    const runtime = getRuntime();

    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    function onDown(event: PointerEvent) {
      // The joystick and the HUD's buttons capture their own pointers and
      // stop propagation; anything that reaches here is the scene.
      if (event.button !== 0 || pointerId !== null) return;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
    }

    function onMove(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      runtime.cam.yaw -= dx * 0.0055;
      runtime.cam.pitch = Math.min(1.15, Math.max(0.12, runtime.cam.pitch + dy * 0.004));
    }

    function onUp(event: PointerEvent) {
      if (event.pointerId === pointerId) pointerId = null;
    }

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [root, getRuntime, enabled]);
}
