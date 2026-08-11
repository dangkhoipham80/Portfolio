import Link from "next/link";

import { eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { isoDay } from "@/lib/format";
import { readingMinutes, summarise } from "@/lib/markdown";
import type { Post } from "@/lib/types";

/**
 * One entry in the blog index.
 *
 * Not a Card, deliberately. Projects and certificates are already card grids,
 * and a third would make the writing read as "projects, but text". A post list
 * is a different kind of object: append-only, reverse-chronological, timestamped
 * and tagged — which is to say a log, the vocabulary this site already speaks
 * in its mono labels. So the index is rows on hairlines with a column of
 * timestamps down the left, and the fixed-width date is what makes that column
 * line up into an edge.
 */
export function PostRow({ post }: { post: Post }) {
  const day = isoDay(post.published_at);
  const minutes = readingMinutes(post.body);
  const blurb = post.excerpt ?? summarise(post.body);

  return (
    <li className="group relative border-b border-border/60">
      <div className="grid gap-x-8 gap-y-2.5 py-7 sm:grid-cols-[6.5rem_1fr]">
        {/*
          The meta column. Side by side above `sm`, where it is a gutter; a
          single inline row below it, where a 6.5rem column would leave the
          title about twenty characters of width.
        */}
        {/*
          The hierarchy inside this column is made by promoting the date, not
          by dimming what sits under it. Dimming was the first attempt — the
          read time and the tags carried `opacity-70` — and it measured 4.26:1
          on 12px text in dark mode, under the 4.5:1 it needs. There was no
          headroom to spend: `--muted-foreground` is already tuned to sit just
          over the line (7.81:1 here), so any opacity on top of it fails.
        */}
        <div className="flex items-baseline gap-3 sm:flex-col sm:gap-1.5">
          {day ? (
            <time
              dateTime={day}
              className={cn(
                eyebrowClasses,
                // Tracking off, unlike every other eyebrow on the site: this
                // one is a fixed-width figure whose job is to line up with the
                // dates above and below it, and letter-spacing on digits works
                // against that.
                "tracking-normal text-foreground transition-colors group-hover:text-primary group-focus-within:text-primary",
              )}
            >
              {day}
            </time>
          ) : null}
          <span className={cn(eyebrowClasses, "tracking-normal")}>{minutes} min</span>
        </div>

        <div>
          {/* h2: the page heading is h1, so h3 here would skip a level. */}
          <h2 className="font-display text-lg font-semibold text-foreground sm:text-xl">
            {/*
              Stretched over the whole row, as on a project card — the row is
              the target, not the seven words of the title.
            */}
            <Link
              href={`/blog/${post.slug}`}
              className="after:absolute after:inset-0 transition-colors group-hover:text-primary"
            >
              {post.title}
            </Link>
          </h2>

          {/* Capped well inside the row: the blurb is prose and wants a measure. */}
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{blurb}</p>

          {post.tags.length > 0 ? (
            /*
              Plain text, not Badge chips. The chips at the top of the page are
              controls you can press; these are data. Giving the two the same
              treatment would promise a filter the row does not offer.
            */
            <p className={cn(eyebrowClasses, "mt-3")}>{post.tags.join(" · ")}</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}
