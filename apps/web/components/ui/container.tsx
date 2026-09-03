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
 * Four tiers. `full` is the public shell and the home page: a gutter and no
 * maximum. The home page used to sit in the 7xl box and at 1440px that left
 * ninety-six pixels of nothing on either side of a page whose one job is to
 * be looked at — the owner's verdict was "left and right are not full". The
 * gutter scales with the viewport so a phone keeps its 20px and a desktop
 * gets a real margin; the cap at 120rem is only there so a 4K monitor does
 * not stretch a paragraph across a metre. `layout` (7xl) is the sections that
 * put cards or a diagram side by side, `wide` (5xl) dense single-purpose
 * grids, `reading` (2xl) prose.
 */
export function Container({
  width = "wide",
  className,
  children,
}: {
  width?: "full" | "wide" | "layout" | "reading";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        width === "full"
          ? "max-w-[120rem] px-5 sm:px-8 lg:px-12"
          : width === "layout"
            ? "max-w-7xl px-5 sm:px-6"
            : width === "wide"
              ? "max-w-5xl px-5 sm:px-6"
              : "max-w-2xl px-5 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
