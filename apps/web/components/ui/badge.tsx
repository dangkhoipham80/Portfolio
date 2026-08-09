import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { ProjectStatus } from "@/lib/types";

const VARIANTS = {
  /** Technology tags, certificate skills — high count, low emphasis. */
  neutral: "bg-accent text-accent-foreground",
  /** Category chips: one per card, so it can carry a little more weight. */
  outline: "border border-border text-muted-foreground",
} as const;

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
        "inline-flex items-center rounded-[--radius-pill] px-2.5 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/*
 * Status colours are spelled out per status rather than interpolated.
 * Tailwind scans source text for complete class names, so a template like
 * `bg-${colour}-500/15` produces no CSS at all — the class exists in the DOM
 * and does nothing.
 */
const STATUS_STYLES: Record<ProjectStatus, string> = {
  // green-700 on the composited 15% green measured 4.33:1 in light mode.
  completed: "bg-green-500/15 text-green-800 dark:text-green-300",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  on_hold: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-300",
  dropped: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  on_hold: "On Hold",
  dropped: "Dropped",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge className={cn("shrink-0", STATUS_STYLES[status])}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
