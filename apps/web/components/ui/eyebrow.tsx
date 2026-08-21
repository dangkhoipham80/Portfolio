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
 * that is not a <p> — a `<dt>`, a `<figcaption>`, a group heading in the
 * console's forms.
 *
 * Not a form's `<label>`, which is what this comment used to recommend above
 * all else, on the argument that a field's label *is* a field name. One field
 * proves that; fifteen disprove it. Uppercase letterspaced mono is a marker
 * style — it works because it is rare on a screen, and a form that sets every
 * label in it has no markers left, only noise. Field labels are quiet now and
 * the eyebrow marks the bands they sit in. See components/ui/field.tsx.
 */
export const eyebrowClasses =
  "font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground";

export function Eyebrow({
  as: Tag = "p",
  className,
  children,
}: {
  /**
   * `h2`/`h3` where the label is a real section heading — the project detail
   * page's Stack/Features/Challenges labels are the only structure below its
   * h1, and as <p> they were invisible to heading navigation.
   */
  as?: "p" | "h2" | "h3";
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn(eyebrowClasses, className)}>{children}</Tag>;
}
