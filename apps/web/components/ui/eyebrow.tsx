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
/**
 * The treatment on its own, for the places that need this look on an element
 * that is not a <p> — a form's <label> above all. A field's label *is* a field
 * name, so it is the most literal use this style has on the site; copying the
 * four utilities into field.tsx is where the two would have drifted apart.
 */
export const eyebrowClasses =
  "font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground";

export function Eyebrow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <p className={cn(eyebrowClasses, className)}>{children}</p>;
}
