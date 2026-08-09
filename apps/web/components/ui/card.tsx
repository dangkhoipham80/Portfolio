import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The surface every content tile sits on.
 *
 * `interactive` adds the lift-on-hover treatment. It is opt-in because a card
 * that visibly responds to the pointer but does nothing when clicked reads as a
 * broken control — only pass it when the whole tile leads somewhere.
 */
export function Card({
  interactive = false,
  className,
  children,
}: {
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        // `relative` so a child link can stretch itself over the whole card.
        "relative flex flex-col rounded-[--radius-card] border border-border bg-card p-5",
        interactive &&
          // The focus-within half matters: the card's link is stretched over the
          // whole tile, but its focus ring draws only around the title text, so
          // a keyboard user got no signal that the tile itself was the target.
          // Mirroring the hover treatment on focus gives them the same affordance.
          "transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-within:-translate-y-0.5 focus-within:border-primary/40 focus-within:shadow-lg focus-within:shadow-primary/5",
        className,
      )}
    >
      {children}
    </div>
  );
}
