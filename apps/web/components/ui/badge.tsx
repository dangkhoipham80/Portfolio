import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { ProjectStatus } from "@/lib/types";

const VARIANTS = {
  /** Technology tags, certificate skills — high count, low emphasis. */
  neutral: "bg-accent text-accent-foreground",
  /** Category chips: one per card, so it can carry a little more weight. */
  outline: "border border-border text-muted-foreground",
} as const;

/*
 * Tech tags and skills are identifiers — package names, service names — so
 * they are set the way the site sets every other identifier: mono, small,
 * tracked. A rounded sans pill says "topic"; this says "dependency".
 */
export const chipClasses =
  "inline-flex items-center rounded-[var(--radius-control)] bg-muted px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/*
 * Status, without hue.
 *
 * These were four Tailwind palettes — green, blue, yellow, red — and they
 * survived the amber only because the amber was louder. With the page
 * monochrome they became the single most colourful thing on it, answering to
 * no token in globals.css, and the `on_hold` yellow was literally the colour
 * the redesign set out to remove.
 *
 * State is carried by the dot instead: filled, ringed, hollow, dim. That is a
 * real encoding rather than decoration — the fill reads as "how far along",
 * and it degrades honestly in greyscale and for anyone who cannot separate
 * red from green, which the old version did not.
 *
 * The label is never colour-only, so the dot is redundant reinforcement
 * rather than the sole carrier of meaning.
 */
const STATUS_DOTS: Record<ProjectStatus, string> = {
  completed: "bg-foreground",
  in_progress: "bg-foreground/40 ring-1 ring-foreground/70",
  on_hold: "border border-muted-foreground/70",
  dropped: "bg-muted-foreground/40",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  on_hold: "On Hold",
  dropped: "Dropped",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1.5 font-mono text-[11px] uppercase tracking-wider"
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[status])}
      />
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
