"use client";

/*
 * A location's panel: the content of one section of the site, opened from
 * inside the world. A sheet on the right, so the island stays where you left
 * it on the left; full-screen on a phone. The content itself is a server-
 * rendered node handed in by the page — this component is the frame, the
 * focus handling and the way out.
 */

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";

import { glassCard } from "./hud";
import { placeById, type PlaceId } from "./places";

export function Panel({
  id,
  children,
  onClose,
}: {
  id: PlaceId;
  children: ReactNode;
  onClose: () => void;
}) {
  const place = placeById(id);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, [id]);

  return (
    <div className="absolute inset-0 z-20">
      {/* The island, dimmed but not gone: a click on it is the way back. */}
      <button
        type="button"
        aria-label="Close and walk on"
        onClick={onClose}
        className="absolute inset-0 hidden w-full cursor-default bg-background/30 sm:block"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className={cn(
          glassCard,
          "world-sheet absolute inset-y-0 right-0 flex w-full flex-col rounded-none border-l sm:inset-y-4 sm:right-4 sm:w-[min(38rem,calc(100%-2rem))] sm:rounded-[var(--radius-card)] sm:border lg:right-8",
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-3 sm:px-8">
          <Eyebrow>
            <span aria-hidden="true" className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle" />
            You are at {place.landmark.toLowerCase()}
          </Eyebrow>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close and walk on"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-accent"
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8">{children}</div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-4 sm:px-8">
          <button type="button" onClick={onClose} className={buttonClasses("quiet")}>
            <span aria-hidden="true">←</span> Walk on
          </button>
          {place.href ? (
            <Link href={place.href} className="inline-flex min-h-11 items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-primary transition-colors hover:text-foreground">
              Open the full page <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
