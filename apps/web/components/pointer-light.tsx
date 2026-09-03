"use client";

/*
 * A client component for one reason: pointer events. The hero's light
 * follows the cursor, and nothing on the server or in CSS knows where the
 * cursor is. It ships no state and renders one empty div; the light itself is
 * a CSS gradient positioned by two custom properties (`.pointer-light` in
 * globals.css), so the only thing JavaScript does is write those two numbers.
 *
 * It listens on its parent, not itself — it is `pointer-events: none` so the
 * hero underneath stays clickable — and it does nothing at all on a device
 * without a hover pointer or for a reader who asked for reduced motion.
 * Writes are batched to one per frame; a pointermove can fire far faster
 * than the screen can paint.
 */

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

export function PointerLight({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const light = ref.current;
    const surface = light?.parentElement;
    if (!light || !surface) return;

    if (!window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) {
      return;
    }

    let frame = 0;

    const move = (event: PointerEvent) => {
      const box = surface.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width) * 100;
      const y = ((event.clientY - box.top) / box.height) * 100;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        light.style.setProperty("--px", `${x.toFixed(2)}%`);
        light.style.setProperty("--py", `${y.toFixed(2)}%`);
        light.style.opacity = "1";
      });
    };

    const leave = () => {
      cancelAnimationFrame(frame);
      light.style.opacity = "0";
    };

    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerleave", leave);

    return () => {
      cancelAnimationFrame(frame);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className={cn("pointer-light", className)} />;
}
