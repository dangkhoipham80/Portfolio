"use client";

// Required by Next.js: an error boundary has to be a client component, because
// it receives a `reset` callback and re-renders in the browser after a failure.

import { useEffect } from "react";

import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";

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
    <Container width="reading" className="py-24 text-center">
      <Eyebrow>Error</Eyebrow>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground">
        This page did not load
      </h1>
      {/*
        States what happened and what to do about it. No apology, and no raw
        error text — the message would mean nothing to a visitor and can leak
        internals.
      */}
      <p className="mt-4 text-muted-foreground">
        Something went wrong while rendering. Trying again usually works.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-[--radius-control] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </Container>
  );
}
