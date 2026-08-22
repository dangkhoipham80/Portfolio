"use client";

// A client component because it reads localStorage, which does not exist on
// the server. There is no CSS-only version of "since you were last here".

import { useEffect, useSyncExternalStore } from "react";

import {
  getServerSnapshot,
  getSnapshot,
  hasRead,
  markVisit,
  subscribe,
} from "@/lib/reading-history";

/**
 * The one lit thing on the blog index.
 *
 * This site's standing rule is that colour never touches text, and hue appears
 * only where something is actually *happening*. On an index of writing, the
 * thing happening is that some of it is new to the person looking at it — so
 * that is what gets the accent, and nothing else does.
 *
 * The mark is deliberately hard to earn. A post lights up only if it was
 * published after this browser last opened the blog *and* has not been opened
 * since. On a first visit there is no previous visit to compare against, so
 * nothing is marked: lighting all fifteen rows would carry exactly as much
 * information as lighting none, and would look like decoration, which is the
 * thing the rule exists to prevent.
 *
 * ## Why it renders nothing on the server
 *
 * The server has no idea what this browser has read, so the first paint cannot
 * know either. `useSyncExternalStore` is the shape for that: the server
 * snapshot is empty, the client's is read from storage, and React reconciles
 * the two without a second render pass. An effect plus `setState` would render,
 * commit, and render again on every row — which is also what the
 * `react-hooks/set-state-in-effect` rule exists to stop.
 *
 * Nothing moves when the mark appears: the row's grid gives this slot its own
 * line, so an absent dot is not a gap that later fills.
 */
export function NewMark({
  slug,
  publishedAt,
}: {
  slug: string;
  /** ISO instant, or null on a post with no publication date. */
  publishedAt: string | null;
}) {
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Null means a first visit — see above — and is what the server snapshot
  // always reports, so this renders nothing until storage has actually been
  // read.
  const since = history.lastVisit;
  const published = publishedAt ? Date.parse(publishedAt) : Number.NaN;

  const isNew =
    since !== null &&
    Number.isFinite(published) &&
    published > since &&
    !hasRead(history, slug);

  if (!isNew) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        // motion-safe only: this is the site's one breathing element on this
        // page, and a pulsing dot with reduced motion on is exactly the kind of
        // thing that preference is about.
        className="h-1.5 w-1.5 rounded-full bg-live motion-safe:animate-[new-pulse_2.4s_ease-in-out_infinite]"
      />
      {/*
        The dot is not the only carrier: a mark that means "new" has to survive
        being read aloud and has to survive not being able to see the hue.
      */}
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
        New
      </span>
    </span>
  );
}

/**
 * Records that the blog was opened, once, on the index.
 *
 * Separate from the marks above because it must run after they have all read
 * the previous value — which `lastVisitAt`'s captured singleton guarantees
 * regardless of order, but keeping the write in one place makes that easier to
 * see than scattering it through fifteen components.
 */
export function VisitRecorder() {
  useEffect(() => {
    markVisit();
  }, []);

  return null;
}
