import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The page's horizontal rhythm, in one place.
 *
 * `mx-auto max-w-5xl px-5` was repeated across the layout and three pages, and
 * the project detail page had drifted to `max-w-3xl` — so the site changed
 * width when you clicked into a project. Reading measure genuinely wants to be
 * narrower than a card grid, so that is a `width` prop rather than an accident.
 */
export function Container({
  width = "wide",
  className,
  children,
}: {
  width?: "wide" | "reading";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-6",
        width === "wide" ? "max-w-5xl" : "max-w-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
