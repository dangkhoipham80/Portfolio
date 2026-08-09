import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A link that leaves the site.
 *
 * `rel="noreferrer noopener"` was being written out by hand at each call site,
 * which is exactly the kind of thing that gets forgotten once and then ships.
 * Centralising it means it cannot be.
 */
export function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        // py-3, not the py-1.5 this started with: that measured 32px tall, under
        // the ~44px a fingertip needs. Used for the contact channels as well as
        // the repo and demo links on a project card, so it is among the most
        // tapped things on the site.
        "inline-flex items-center gap-1 py-3 text-sm text-muted-foreground transition-colors hover:text-primary",
        className,
      )}
    >
      {children}
      {/* Marks the "leaves the site" affordance without announcing it twice. */}
      <span aria-hidden="true" className="text-[0.9em]">
        ↗
      </span>
    </a>
  );
}
