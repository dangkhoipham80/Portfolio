import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The page's horizontal rhythm, in one place.
 *
 * `mx-auto max-w-5xl px-5` was repeated across the layout and three pages, and
 * the project detail page had drifted to `max-w-3xl` — so the site changed
 * width when you clicked into a project. Reading measure genuinely wants to be
 * narrower than a card grid, so that is a `width` prop rather than an accident.
 *
 * Three tiers: `layout` (7xl) for the shell and the sections that put cards or
 * a diagram side by side — at 5xl those left a third of a 1500px screen empty.
 * `wide` (5xl) for dense single-purpose grids, `reading` (2xl) for prose.
 */
export function Container({
  width = "wide",
  className,
  children,
}: {
  width?: "wide" | "layout" | "reading";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-6",
        width === "layout"
          ? "max-w-7xl"
          : width === "wide"
            ? "max-w-5xl"
            : "max-w-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
