"use client";

// A client component because the history lives in localStorage — see
// lib/reading-history.ts for why it is not on the server.

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { readMyReading } from "@/app/actions/engagement";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import {
  clearHistory,
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/reading-history";
import type { ReadingProgress } from "@/lib/types";
import { useViewer } from "@/lib/viewer-store";

/** One row of the panel, from whichever of the two sources filled it. */
type Entry = {
  slug: string;
  title: string;
  progress?: number;
  finished?: boolean;
};

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
 *
 * ## Why a signed-in reader sees a different list
 *
 * Same panel, better source. An account keeps its reading against the account
 * rather than against the browser, so the list follows them to another device
 * and can say which posts are finished — neither of which localStorage can do.
 * The panel is otherwise identical, because it is the same thing: this is not a
 * second component, it is one component with somewhere better to read from.
 *
 * The "Clear" control goes with it. What it erases is this browser's copy, and
 * offering it over a list that is not this browser's copy would be a button
 * that appears to do nothing.
 */
export function ContinueReading() {
  // The server's snapshot is empty, so this renders nothing until the browser's
  // storage has been read — and then renders once, rather than mounting empty
  // and setting state. See lib/reading-history.ts.
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { status, viewer } = useViewer();
  const signedIn = status === "ready" && Boolean(viewer);
  const [account, setAccount] = useState<ReadingProgress[] | null>(null);

  useEffect(() => {
    if (!signedIn) return;

    let active = true;
    readMyReading()
      .then((entries) => active && setAccount(entries))
      // The browser's own list is still there and still correct about this
      // device, which is the right thing to fall back to.
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [signedIn]);

  const entries: Entry[] = (
    account
      ? account
          .filter((entry) => entry.post_slug !== null)
          .map((entry) => ({
            slug: entry.post_slug as string,
            title: entry.post_title ?? entry.post_slug as string,
            progress: entry.progress,
            finished: entry.finished,
          }))
      : history.entries
  ).slice(0, 5);

  if (entries.length === 0) return null;

  return (
    <aside aria-labelledby="continue-reading" className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow id="continue-reading">You have read</Eyebrow>
        {account ? (
          // The account's list is not this browser's to clear, and it has a
          // page of its own where a reader can see all of it.
          <Link
            href="/reading"
            className={cn(
              eyebrowClasses,
              "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-1 transition-colors hover:text-primary lg:min-h-8",
            )}
          >
            All
          </Link>
        ) : (
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
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/blog/${entry.slug}`}
              className="group block rounded-[var(--radius-control)]"
            >
              <span className="flex items-baseline gap-2">
                {entry.finished ? (
                  // The completion mark: a node in the one hue that means
                  // "this is true", never a tick and never a colour on text.
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 translate-y-[-0.1em] rounded-full bg-live"
                  />
                ) : null}
                <span className="line-clamp-2 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
                  {entry.title}
                </span>
                {entry.finished ? <span className="sr-only">Finished</span> : null}
              </span>

              {!entry.finished &&
              typeof entry.progress === "number" &&
              entry.progress < 0.9 ? (
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
