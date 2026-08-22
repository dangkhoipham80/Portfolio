"use client";

// A client component: rating is a pointer interaction with hover preview and an
// optimistic redraw, none of which a form post can do without a page reload
// that loses the reader's place in the article.

import { useState, useTransition } from "react";

import { ratePost } from "@/app/actions/engagement";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import type { RatingSummary } from "@/lib/types";

/**
 * Was this any good? — five stars, one vote per reader.
 *
 * ## The stars are not gold
 *
 * This site's rule is that colour never touches text and hue marks what is
 * happening, not what things are. A rating is a stored value, so the filled
 * stars are ink. The one moment something *is* happening is the instant a vote
 * lands, and that is the only time `--live` appears here — a brief confirmation
 * beside the average, then gone.
 *
 * ## Why the count is never hidden
 *
 * 5.0 from one vote and 4.6 from fifty are not the same claim and an average
 * alone cannot tell them apart. The count is rendered in the same breath as the
 * figure, every time, including when it is zero.
 */
export function Rating({
  postId,
  initial,
}: {
  postId: number;
  initial: RatingSummary;
}) {
  const [summary, setSummary] = useState(initial);
  const [hovered, setHovered] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const [pending, startTransition] = useTransition();

  const mine = summary.mine;
  // What the stars show right now: the value being hovered wins over the stored
  // one, so the control previews the vote before it is made.
  const shown = hovered ?? mine ?? 0;

  function vote(stars: number) {
    setFailed(false);

    startTransition(async () => {
      const result = await ratePost(postId, stars);

      if (!result.summary) {
        setFailed(true);
        return;
      }

      setSummary(result.summary);
      setJustVoted(true);
    });
  }

  return (
    <section
      aria-labelledby="rating-heading"
      className="rounded-[var(--radius-card)] border border-border bg-card p-6"
    >
      <Eyebrow id="rating-heading">Was this useful?</Eyebrow>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        {/*
          A radiogroup, not a row of buttons: the five are mutually exclusive
          choices of one value, which is what a radio group means, and it gets
          arrow-key navigation from the browser rather than from a keydown
          handler written here.
        */}
        <div
          role="radiogroup"
          aria-label="Rate this post out of five"
          className="flex items-center"
          onMouseLeave={() => setHovered(null)}
        >
          {[1, 2, 3, 4, 5].map((stars) => (
            <button
              key={stars}
              type="button"
              role="radio"
              aria-checked={mine === stars}
              aria-label={`${stars} ${stars === 1 ? "star" : "stars"}`}
              disabled={pending}
              onMouseEnter={() => setHovered(stars)}
              onFocus={() => setHovered(stars)}
              onBlur={() => setHovered(null)}
              onClick={() => vote(stars)}
              className={cn(
                // 44px tap target, which the star glyph alone is nowhere near.
                "inline-flex h-11 w-9 items-center justify-center rounded-[var(--radius-control)] transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "disabled:cursor-progress",
                stars <= shown ? "text-foreground" : "text-border hover:text-muted-foreground",
              )}
            >
              <Star filled={stars <= shown} />
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          {summary.count === 0 ? (
            "No ratings yet — be the first."
          ) : (
            <>
              <span className="font-mono tabular-nums text-foreground">
                {summary.average.toFixed(1)}
              </span>{" "}
              from {summary.count} {summary.count === 1 ? "rating" : "ratings"}
            </>
          )}
        </p>

        {/*
          The one lit moment. `aria-live="polite"` because the visual
          confirmation is a colour change beside a number, which is exactly the
          kind of feedback that otherwise reaches nobody using a screen reader.
        */}
        <p aria-live="polite" className="text-sm">
          {failed ? (
            <span className="text-destructive-text">
              That did not save. Try again in a moment.
            </span>
          ) : justVoted ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-live" />
              Thanks — you rated this {mine}.
            </span>
          ) : null}
        </p>
      </div>

      {summary.count > 0 ? <Distribution summary={summary} /> : null}
    </section>
  );
}

/**
 * The five bucket counts as bars.
 *
 * Worth the space because a mean hides shape: 3.0 from "everyone said three"
 * and 3.0 from "half said one, half said five" are different facts about a
 * post, and only one of them means the post is fine.
 */
function Distribution({ summary }: { summary: RatingSummary }) {
  const highest = Math.max(...summary.distribution, 1);

  return (
    <ul className="mt-5 space-y-1.5">
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = summary.distribution[stars - 1] ?? 0;

        return (
          <li key={stars} className="flex items-center gap-3 text-xs">
            <span className="w-3 shrink-0 font-mono tabular-nums text-muted-foreground">
              {stars}
            </span>
            <span aria-hidden="true" className="h-1.5 flex-1 rounded-[var(--radius-pill)] bg-muted">
              <span
                className="block h-1.5 rounded-[var(--radius-pill)] bg-foreground/40"
                // Scaled against the largest bucket rather than the total, so a
                // 40/1/0/0/2 split still shows the shape instead of one bar and
                // four slivers.
                style={{ width: `${(count / highest) * 100}%` }}
              />
            </span>
            <span className="w-6 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
              {count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Inline SVG rather than the ★ character.
 *
 * A text star renders in whatever the system font decides — colour emoji on
 * some platforms, a different weight on others — and the one thing this control
 * must not do is introduce a colour nobody chose. `currentColor` keeps it on
 * the palette.
 */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 transition-transform duration-150"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <path d="M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8z" />
    </svg>
  );
}
