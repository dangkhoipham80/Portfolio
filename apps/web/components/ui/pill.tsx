import { cn } from "@/lib/cn";

/**
 * The glass pill: a mono label on a translucent blurred surface, for
 * controls that sit over the island. The HUD's buttons, the place strip on
 * the title view and the toasts are all this one shape, so a control over
 * the scene is recognisable as one wherever it floats.
 *
 * `lit` is the hover treatment, applied from outside for the case where
 * something other than the pointer lights it — a place under the cursor in
 * the scene, a quest being guided.
 */
export function pillClasses(lit = false, className?: string): string {
  return cn(
    "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)] border bg-background/75 px-4 font-mono text-xs uppercase tracking-[0.18em] backdrop-blur-md transition-[color,border-color,translate,background-color] duration-200",
    lit
      ? "-translate-y-px border-primary/50 text-primary"
      : "border-border/70 text-foreground hover:-translate-y-px hover:border-primary/50 hover:text-primary",
    className,
  );
}
