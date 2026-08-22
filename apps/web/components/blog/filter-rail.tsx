import Link from "next/link";

import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import type { Series, Tag } from "@/lib/types";

/**
 * The blog index's left rail: search, subjects, series.
 *
 * ## Why the page has a rail at all
 *
 * The index used to be a single 5xl column, which on a 1500px screen left
 * roughly a third of the width empty on each side. The fix is not to stretch
 * the prose — a blurb wants a reading measure and a 1400px line is unreadable —
 * it is to give the margin something to do. Everything here is a *control*,
 * which is what a margin beside a list of results is for, and the reading
 * column keeps its measure.
 *
 * ## Why the counts are a right-aligned column
 *
 * Because it makes the rail an index in the book sense: a subject and how much
 * there is of it, aligned so the quantities compare at a glance. A count
 * trailing each name in brackets reads as a footnote instead, and does not line
 * up.
 *
 * ## Why these are links and not a filter widget
 *
 * Each facet is a URL that can be shared, linked and opened in a new tab, and
 * the page it leads to is rendered on the server. A `useState` filter would
 * throw all of that away to avoid a navigation nobody minds — and would make
 * the whole rail a client component for the sake of it.
 */

export function FilterRail({
  tags,
  series,
  totalPosts,
  activeTag,
  activeSeries,
  query,
}: {
  tags: Tag[];
  series: Series[];
  /**
   * How many posts there are.
   *
   * Passed in rather than summed from `tags`, which is what this did first and
   * which was wrong: a post carries several tags, so the sum counts it once per
   * tag. Three posts with three tags each read as "Everything 9".
   */
  totalPosts: number;
  /** Slug of the tag whose page this is, if any. */
  activeTag?: string;
  activeSeries?: string;
  /** The current search term, so the field keeps what was typed. */
  query?: string;
}) {
  return (
    // Stickiness belongs to the wrapper in index-shell.tsx, which holds this
    // and the reading history together — two separately-sticky boxes in one
    // column stick at the same offset and overlap.
    <div>
      <SearchField query={query} />

      {tags.length > 0 ? (
        <RailSection title="Subjects">
          <RailLink
            href="/blog"
            label="Everything"
            count={totalPosts}
            active={!activeTag && !activeSeries}
          />
          {tags.map((tag) => (
            <RailLink
              key={tag.slug}
              href={`/blog/tag/${tag.slug}`}
              label={tag.name}
              count={tag.post_count}
              active={tag.slug === activeTag}
            />
          ))}
        </RailSection>
      ) : null}

      {series.length > 0 ? (
        <RailSection title="Series">
          {series.map((entry) => (
            <RailLink
              key={entry.slug}
              href={`/blog/series/${entry.slug}`}
              label={entry.title}
              count={entry.post_count}
              active={entry.slug === activeSeries}
            />
          ))}
        </RailSection>
      ) : null}

      {/*
        Underlined, and not in the eyebrow's uppercase mono. It sat directly
        under two headings set in exactly that treatment and read as a third
        heading with nothing beneath it rather than as something you can press.
      */}
      <Link
        href="/blog/feed.xml"
        className={cn(
          "inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4 transition-colors lg:min-h-9",
          "hover:text-foreground",
        )}
      >
        RSS feed
      </Link>
    </div>
  );
}

/**
 * The search box.
 *
 * A plain GET form with no JavaScript anywhere near it. Submitting navigates to
 * `/blog?q=…`, which is a shareable URL and a server render — and it works with
 * scripting off, which a debounced client filter does not. There is no
 * as-you-type filtering and that is the trade: one keystroke of latency for a
 * result you can link someone to.
 */
function SearchField({ query }: { query?: string }) {
  return (
    <form action="/blog" role="search" className="mb-8">
      <label htmlFor="blog-search" className={cn(eyebrowClasses, "mb-2 block")}>
        Search
      </label>
      <div className="flex gap-2">
        <input
          id="blog-search"
          type="search"
          name="q"
          // `defaultValue`, not `value`: this is an uncontrolled input in a
          // server component, and a `value` with no handler would freeze it.
          defaultValue={query}
          placeholder="A phrase you remember"
          className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-[var(--radius-control)] border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Find
        </button>
      </div>
    </form>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title} className="mb-8">
      <Eyebrow className="mb-2">{title}</Eyebrow>
      <ul>{children}</ul>
    </nav>
  );
}

function RailLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        // aria-current, not colour and weight alone: which facet is applied is
        // the only state on this page, and it has to survive being read out.
        aria-current={active ? "page" : undefined}
        className={cn(
          // 44px on a phone, where the rail is a stack of full-width rows and
          // each one is a thumb target. Tighter from `lg`, where it is a dense
          // vertical index read with a pointer and the neighbours are the same
          // kind of thing, so the spacing between rows is what stops a mis-tap.
          // Measured at 375 rather than assumed — they were 36px.
          "flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-control)] px-2 text-sm transition-colors lg:min-h-9",
          active
            ? "bg-accent font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <span className="truncate">{label}</span>
        {/*
          Tabular figures so the counts form a column rather than a ragged
          edge — the whole reason they are aligned right.
        */}
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      </Link>
    </li>
  );
}
