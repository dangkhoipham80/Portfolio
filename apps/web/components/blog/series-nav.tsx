import Link from "next/link";

import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import type { Post, SeriesRef } from "@/lib/types";

/**
 * Where this post sits in its series, and what comes next.
 *
 * ## Why the whole run is listed rather than just next and previous
 *
 * A series is a list, and the reader arriving at part 3 from a search result
 * needs to see that parts 1 and 2 exist before deciding whether to keep
 * reading. Next/previous alone answers "where do I go from here" and not "what
 * is this", which is the question someone who landed in the middle is asking.
 *
 * ## Why the current part is not a link
 *
 * It is the page you are on. A link to here is a link that does nothing, and it
 * takes a tab stop to find that out.
 */
export function SeriesNav({
  series,
  posts,
  currentSlug,
}: {
  series: SeriesRef;
  /** The series' posts in reading order, as the API returns them. */
  posts: Post[];
  currentSlug: string;
}) {
  if (posts.length < 2) return null;

  const index = posts.findIndex((post) => post.slug === currentSlug);

  return (
    <nav
      aria-labelledby="series-heading"
      className="rounded-[var(--radius-card)] border border-border bg-card p-5"
    >
      <Eyebrow id="series-heading" className="mb-1">
        Part {index + 1} of {posts.length}
      </Eyebrow>
      <p className="text-sm font-semibold text-foreground">
        <Link
          href={`/blog/series/${series.slug}`}
          className="transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {series.title}
        </Link>
      </p>

      <ol className="mt-4 space-y-1">
        {posts.map((post, position) => {
          const current = post.slug === currentSlug;

          return (
            <li key={post.slug} className="flex gap-3 text-sm">
              {/*
                Tabular figures so the numbers form a column — the list is a
                sequence and the numbering is the information in it.
              */}
              <span
                className={cn(
                  "shrink-0 font-mono text-xs tabular-nums",
                  current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {String(position + 1).padStart(2, "0")}
              </span>

              {current ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {post.title}
                </span>
              ) : (
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {post.title}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The pair of steps at the foot of a post.
 *
 * Separate from the list above because it does a different job: that one is
 * orientation, read on arrival; this one is the thing you press when you have
 * finished reading and it needs to be where your eyes already are.
 */
export function SeriesSteps({
  posts,
  currentSlug,
}: {
  posts: Post[];
  currentSlug: string;
}) {
  const index = posts.findIndex((post) => post.slug === currentSlug);
  if (index === -1) return null;

  const previous = posts[index - 1];
  const next = posts[index + 1];

  if (!previous && !next) return null;

  return (
    <nav aria-label="Series" className="mt-12 grid gap-4 sm:grid-cols-2">
      <Step post={previous} direction="previous" />
      <Step post={next} direction="next" />
    </nav>
  );
}

function Step({
  post,
  direction,
}: {
  post: Post | undefined;
  direction: "previous" | "next";
}) {
  // An empty grid cell rather than a disabled control: at the start of a series
  // there is no previous part, and a greyed-out box saying so is a thing to
  // read that says nothing.
  if (!post) return <div aria-hidden="true" />;

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        "group rounded-[var(--radius-card)] border border-border p-4 transition-colors hover:border-foreground/30 hover:bg-muted",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        direction === "next" && "sm:text-right",
      )}
    >
      <span className={cn(eyebrowClasses, "block")}>
        {direction === "previous" ? "← Previous part" : "Next part →"}
      </span>
      <span className="mt-1.5 block text-sm font-medium text-foreground transition-colors group-hover:text-primary">
        {post.title}
      </span>
    </Link>
  );
}
