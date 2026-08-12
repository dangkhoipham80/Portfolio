import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { eyebrowClasses } from "@/components/ui/eyebrow";

/**
 * The body of a 404, shared by the two boundaries that render one.
 *
 * In the site's own voice: a route nothing answers on, ending in a dashed —
 * unterminated — spine segment. An empty screen is an invitation to act, so
 * it points somewhere useful rather than apologising.
 */
export function NotFoundContent() {
  return (
    <Container width="layout" className="py-28 sm:py-36">
      <p className={`${eyebrowClasses} flex items-center gap-3`}>
        <span aria-hidden="true" className="spine-node shrink-0" />
        404 — route not found
      </p>
      <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
        Nothing is listening on this path
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        The link may be out of date, or what it pointed at is not published.
      </p>
      {/* The line goes on, but nothing terminates it. */}
      <div aria-hidden="true" className="mt-10 w-48 border-t-2 border-dashed border-border" />
      <Link href="/" className={buttonClasses("primary", "mt-10")}>
        Back to the portfolio
      </Link>
    </Container>
  );
}
