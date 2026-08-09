import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The small mono label above a section or beside a date.
 *
 * Monospace here is not a texture choice. These lines are field names, counts
 * and timestamps — the vocabulary of logs and schemas, which is the subject of
 * this site. Setting them in the same face as the body would throw away that
 * signal; setting body copy in mono would be costume.
 */
export function Eyebrow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
