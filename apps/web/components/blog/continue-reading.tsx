"use client";

// A client component because the history lives in localStorage — see
// lib/reading-history.ts for why it is not on the server.

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import {
  clearHistory,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/reading-history";

/**
 * What this browser has been reading, in the index's right margin.
 *
 * ## Why it renders nothing when there is nothing
 *
 * A first-time visitor has no history, and an empty panel saying "no history
 * yet" is a promise that the site is watching them — which is both unpleasant
 * and, here, untrue in the way it implies. So the panel does not exist until it
 * has something to say, and the grid column it sits in collapses with it.
 *
 * ## Why there is a way to erase it
 *
 * Because there has to be. The data never leaves the browser, but "never leaves
 * the browser" is only reassuring if the person can see what is in it and get
 * rid of it — on a shared machine especially. One button, no confirmation
 * dialog: nothing here is worth guarding, and the cost of a mis-click is that
 * you lose a convenience.
 */
export function ContinueReading() {
  // The server's snapshot is empty, so this renders nothing until the browser's
  // storage has been read — and then renders once, rather than mounting empty
  // and setting state. See lib/reading-history.ts.
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const entries = history.entries.slice(0, 5);

  if (entries.length === 0) return null;

  return (
    <aside aria-labelledby="continue-reading" className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow id="continue-reading">You have read</Eyebrow>
        <button
          type="button"
          // No local state to update: the store publishes and every subscriber
          // — this panel and every "new since" mark on the page — redraws.
          onClick={clearHistory}
          className={cn(
            eyebrowClasses,
            "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-1 transition-colors hover:text-primary lg:min-h-8",
          )}
        >
          Clear
        </button>
      </div>

      <ul className="mt-3 space-y-3">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/blog/${entry.slug}`}
              className="group block rounded-[var(--radius-control)]"
            >
              <span className="line-clamp-2 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
                {entry.title}
              </span>
              {typeof entry.progress === "number" && entry.progress < 0.9 ? (
                /*
                  How far they got, when they did not finish. Above 90% the bar
                  is not useful — the post is read — and showing a nearly-full
                  track invites the reader to go back and find the last
                  paragraph they already saw.
                */
                <span
                  aria-hidden="true"
                  className="mt-1.5 block h-px w-full bg-border"
                >
                  <span
                    className="block h-px bg-foreground/50"
                    style={{ width: `${Math.round(entry.progress * 100)}%` }}
                  />
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
