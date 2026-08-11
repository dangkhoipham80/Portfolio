import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";

/**
 * The body of a 404, shared by the two boundaries that render one.
 *
 * An empty screen is an invitation to act, so this points somewhere useful
 * rather than apologising.
 */
export function NotFoundContent() {
  return (
    <Container width="reading" className="py-24 text-center">
      <Eyebrow>404</Eyebrow>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
        This page does not exist
      </h1>
      <p className="mt-4 text-muted-foreground">
        The link may be out of date, or the project behind it is not published.
      </p>
      <Link href="/" className={buttonClasses("primary", "mt-8")}>
        Back to the portfolio
      </Link>
    </Container>
  );
}
