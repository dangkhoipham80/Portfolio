"use client";

// Required by Next.js: an error boundary has to be a client component, because
// it receives a `reset` callback and re-renders in the browser after a failure.

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { eyebrowClasses } from "@/components/ui/eyebrow";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Without this the digest is the only trace, and only in the server log.
    console.error("[page] render failed:", error);
  }, [error]);

  return (
    <Container width="layout" className="py-28 sm:py-36">
      <p className={`${eyebrowClasses} flex items-center gap-3`}>
        <span aria-hidden="true" className="spine-node shrink-0" />
        error — render failed
      </p>
      <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        This page did not load
      </h1>
      {/*
        States what happened and what to do about it. No apology, and no raw
        error text — the message would mean nothing to a visitor and can leak
        internals.
      */}
      <p className="mt-4 max-w-md text-muted-foreground">
        Something went wrong while rendering. Trying again usually works.
      </p>
      <Button onClick={reset} className="mt-10">
        Try again
      </Button>
    </Container>
  );
}
