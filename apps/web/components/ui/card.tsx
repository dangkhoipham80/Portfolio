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
        // Surface-step depth: the card is a lighter layer on the ink, with a
        // half-strength border and a 1px inner top highlight (dark mode's
        // "lit edge") doing the separating, not a hard outline.
        "relative flex flex-col rounded-[var(--radius-card)] border border-border/60 bg-card p-6 shadow-[0_1px_2px_hsl(0_0%_0%/0.06)] dark:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04),0_1px_2px_hsl(0_0%_0%/0.4)]",
        interactive &&
          // The focus-within half matters: the card's link is stretched over the
          // whole tile, but its focus ring draws only around the title text, so
          // a keyboard user got no signal that the tile itself was the target.
          // Mirroring the hover treatment on focus gives them the same affordance.
          "transition duration-200 hover:-translate-y-1 hover:bg-raised hover:border-primary/30 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_12px_32px_hsl(0_0%_0%/0.5)] focus-within:-translate-y-1 focus-within:bg-raised focus-within:border-primary/30",
        className,
      )}
    >
      {children}
    </div>
  );
}
