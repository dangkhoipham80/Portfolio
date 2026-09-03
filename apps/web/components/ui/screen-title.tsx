import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The `<h1>` on a console entry screen — sign in, reset, the dead-link notice.
 *
 * Extracted because the three of them now say the same thing four different
 * times: the two reset screens each render one of several headings depending on
 * what the API answered, so the string that used to appear once per page
 * appears three times in one component. That is the point at which a padding or
 * a tracking value on one of them quietly drifts.
 *
 * Scoped to these screens on purpose. The /admin pages use a near-identical
 * heading without the `sm:text-4xl` step — a real difference, since those sit
 * beside a sidebar rather than alone on the page — and folding both into one
 * component with a variant prop would be inventing a distinction to abstract
 * over rather than removing a duplicate.
 */
export function ScreenTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <h1
      className={cn(
        "mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl",
        className,
      )}
    >
      {children}
    </h1>
  );
}
