import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A bordered line of prose for something the page has to say and the reader
 * cannot act on immediately: a rate limit with a wait attached, a backend that
 * is not answering, an inbox that could not be loaded.
 *
 * A toast was the other option and is worse for exactly these cases — it
 * disappears, and the states worth reading are the ones you cannot fix in the
 * moment.
 *
 * Extracted once the same class string existed in the contact form, the sign-in
 * form and the admin inbox.
 */
export function Notice({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "rounded-[var(--radius-control)] border border-border bg-card px-4 py-3 text-sm text-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
