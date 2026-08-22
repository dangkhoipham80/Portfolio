"use client";

// A client component because the history lives in localStorage and the progress
// figure comes from scroll position. Neither exists on the server.

import { useEffect, useRef } from "react";

import { markRead } from "@/lib/reading-history";

/**
 * Notes that this post was opened, and roughly how far the reader got.
 *
 * Renders nothing. It exists so the index can show "you have read" and so an
 * unfinished post can be offered back with the bar showing where you stopped —
 * see components/blog/continue-reading.tsx.
 *
 * ## Why the progress is throttled by value, not by time
 *
 * A scroll listener that wrote on every event would hit localStorage hundreds
 * of times a second. A timer would keep firing on a page nobody is scrolling.
 * Writing only when the figure has moved by a tenth does neither: it is at most
 * ten writes for a full read, and none at all for a reader who opens the post
 * and does not scroll.
 *
 * `passive: true` on the listener because this never calls `preventDefault`,
 * and without it the browser has to wait for the handler before scrolling.
 */
export function ReadRecorder({ slug, title }: { slug: string; title: string }) {
  // A ref rather than state: nothing renders from this, and setState here would
  // re-run the component on every tenth of the page.
  const lastWritten = useRef(-1);

  useEffect(() => {
    markRead(slug, title, 0);

    function record() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      // A post shorter than the viewport has nothing to scroll, so it is read.
      const progress = scrollable > 0 ? window.scrollY / scrollable : 1;
      const bucket = Math.min(10, Math.max(0, Math.round(progress * 10)));

      if (bucket === lastWritten.current) return;
      lastWritten.current = bucket;
      markRead(slug, title, bucket / 10);
    }

    record();
    window.addEventListener("scroll", record, { passive: true });
    return () => window.removeEventListener("scroll", record);
  }, [slug, title]);

  return null;
}
