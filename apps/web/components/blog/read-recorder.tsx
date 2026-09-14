"use client";

// A client component because the history lives in localStorage, the progress
// figure comes from scroll position, and whether anyone is signed in is a fact
// about a cookie. None of the three exists on the server.

import { useCallback, useEffect, useRef, useState } from "react";

import { readMyProgress, recordReadingProgress } from "@/app/actions/engagement";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { markRead } from "@/lib/reading-history";
import type { ReadingProgress } from "@/lib/types";
import { useViewer } from "@/lib/viewer-store";

/**
 * How far the reader has got, kept — and, for a signed-in one, shown.
 *
 * ## Two stores, and why both stay
 *
 * localStorage is what an anonymous reader gets. It costs no row, makes no
 * claim about anyone and cannot be breached, which is the argument
 * lib/reading-history.ts makes and which is still right for somebody who has
 * not asked to be known. The server copy is what an account buys: the same
 * position on a phone as on the laptop it was left on, which is the one thing
 * the browser's own storage cannot do.
 *
 * Both are written, always. Not only does that mean a reader who signs in later
 * keeps the history they already had — it means the index's "you have read"
 * marks keep working while the session answer is still in flight, which is
 * every first paint.
 *
 * ## Why the writes are throttled twice over
 *
 * By value and by time, and they catch different things. Writing on every
 * scroll event would be hundreds of requests a second; a timer alone keeps
 * firing on a page nobody is scrolling. So a write needs the figure to have
 * moved by a twentieth *and* five seconds to have passed — at most a dozen
 * requests for a full read of a long article, and none at all for somebody who
 * opens a post and does not scroll.
 *
 * `pagehide` catches the rest. A reader who stops halfway and closes the tab
 * has moved since the last write, and without this their position would be
 * whatever it was five seconds and one bucket ago — which is the case this
 * whole feature is for. `sendBeacon` is not used: the write is a Server Action,
 * not a URL, and the action survives the page going away because the request is
 * already in flight by the time it does.
 *
 * ## Why "finished" is a control and not only a threshold
 *
 * Because reaching the end of the page and being done with an article are
 * different things, and only the reader knows which one happened. Crossing the
 * threshold marks it — the API decides where that is — and the control is there
 * for the other case: a post you have read enough of, or one you want back on
 * the pile.
 */

/** Twentieths of the article. A write needs the figure to cross one. */
const BUCKETS = 20;

/** And this long since the last one. */
const THROTTLE_MS = 5000;

export function ReadRecorder({
  postId,
  slug,
  title,
}: {
  postId: number;
  slug: string;
  title: string;
}) {
  const { status, viewer } = useViewer();
  const signedIn = status === "ready" && Boolean(viewer);

  const [stored, setStored] = useState<ReadingProgress | null>(null);
  const [pending, setPending] = useState(false);
  /*
    Where the reader is now, for the figure below.

    State rather than a ref, because it is rendered — and at bucket granularity
    rather than per scroll event, so it costs at most twenty renders for a whole
    article rather than one per frame. The refs beside it are the ones nothing
    renders from.
  */
  const [live, setLive] = useState(0);

  const lastBucket = useRef(-1);
  const lastWrite = useRef(0);
  const latest = useRef(0);

  /** Where the reader is now, 0 to 1. A post shorter than the viewport is read. */
  const measure = useCallback(() => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? window.scrollY / scrollable : 1;
    return Math.min(1, Math.max(0, progress));
  }, []);

  // What the account already knows about this post, so the control below opens
  // in the right state rather than flashing "not finished" at somebody who has.
  useEffect(() => {
    if (!signedIn) return;

    // `active`, not `live` — that name is the progress figure two lines up, and
    // shadowing it here is the kind of thing that reads fine and is wrong.
    let active = true;
    readMyProgress(postId)
      .then((current) => active && setStored(current))
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [postId, signedIn]);

  useEffect(() => {
    markRead(slug, title, 0);

    function record(force = false) {
      const progress = measure();
      latest.current = progress;

      const bucket = Math.round(progress * BUCKETS);
      const now = Date.now();
      const moved = bucket !== lastBucket.current;

      if (!force && (!moved || now - lastWrite.current < THROTTLE_MS)) return;
      if (!moved && !force) return;

      lastBucket.current = bucket;
      lastWrite.current = now;
      setLive(bucket / BUCKETS);

      markRead(slug, title, bucket / BUCKETS);
      // Fire and forget. There is nothing a reader three paragraphs further on
      // can do with a confirmation, and the next scroll writes again.
      if (signedIn) void recordReadingProgress(postId, progress);
    }

    function onScroll() {
      record();
    }

    function onLeave() {
      // The case the throttle exists for, and the case it would otherwise lose.
      record(true);
    }

    record(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onLeave);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onLeave);
      // A client-side navigation to another post unmounts this without a
      // pagehide, so the last stretch of reading would go unrecorded.
      onLeave();
    };
  }, [measure, postId, signedIn, slug, title]);

  if (!signedIn) return null;

  const finished = stored?.finished ?? false;
  const progress = Math.max(stored?.progress ?? 0, live);

  async function toggle() {
    setPending(true);
    const next = !finished;
    // Optimistic: the control is a statement about what the reader has done,
    // and making them wait for a round trip to see it registered reads as a
    // dropped press.
    setStored((current) => ({
      post_id: postId,
      progress: current?.progress ?? latest.current,
      finished: next,
      finished_at: next ? new Date().toISOString() : null,
      last_read_at: new Date().toISOString(),
      post_slug: slug,
      post_title: title,
    }));

    await recordReadingProgress(postId, Math.max(latest.current, next ? 1 : 0), next);
    setPending(false);
  }

  return (
    <div className="mt-14 max-w-measure 2xl:max-w-measure-wide">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Eyebrow>
          {finished ? "Finished" : `${Math.round(progress * 100)}% read`}
        </Eyebrow>

        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={finished}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3",
            "font-mono text-xs uppercase tracking-[0.18em] transition-colors",
            "text-muted-foreground hover:text-primary disabled:opacity-70",
          )}
        >
          {/*
            A node, not a tick. The site marks state with a dot — StatusBadge,
            Notice and the nav's current page all do — and it is filled with
            `--live` only when something is true, which is the one job that hue
            has here.
          */}
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 rounded-full border border-border",
              finished && "border-live bg-live",
            )}
          />
          {finished ? "Mark unread" : "Mark as finished"}
        </button>
      </div>

      {/*
        The bar, at hairline weight. It repeats what the eyebrow says in words,
        which is the point — a number is exact and a line is glanceable — and it
        is hidden from assistive tech because the words are already there.
      */}
      <span aria-hidden="true" className="mt-3 block h-px w-full bg-border">
        <span
          className={cn("block h-px", finished ? "bg-live" : "bg-foreground/50")}
          style={{ width: `${Math.round((finished ? 1 : progress) * 100)}%` }}
        />
      </span>
    </div>
  );
}
