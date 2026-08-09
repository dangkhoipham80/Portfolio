import Link from "next/link";

import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";

/**
 * An empty screen is an invitation to act, so this points somewhere useful
 * rather than apologising.
 */
export default function NotFound() {
  return (
    <Container width="reading" className="py-24 text-center">
      <Eyebrow>404</Eyebrow>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
        This page does not exist
      </h1>
      <p className="mt-4 text-muted-foreground">
        The link may be out of date, or the project behind it is not published.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-[--radius-control] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Back to the portfolio
      </Link>
    </Container>
  );
}
