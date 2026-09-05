import Image from "next/image";
import Link from "next/link";

import { NewMark } from "@/components/blog/new-mark";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { isOptimisableImage } from "@/lib/blob";
import { cn } from "@/lib/cn";
import { isoDay } from "@/lib/format";
import { DEFAULT_LANGUAGE, langAttribute, languageFor } from "@/lib/languages";
import { readingMinutes, summarise } from "@/lib/markdown";
import type { Post } from "@/lib/types";

/**
 * The blog index, as a ledger.
 *
 * ## Why this is not a grid of cards
 *
 * Projects and certificates are already card grids. A third would make the
 * writing read as "projects, but text", and it is not that: a blog is
 * append-only, reverse-chronological, timestamped and filed — which is to say a
 * log, the vocabulary this site already speaks in its mono labels. So it is
 * rows on hairlines with a fixed-width date column down the left, and that
 * column lining up into an edge is what makes it read as a record rather than
 * as a list of headlines.
 *
 * ## Why the years are dividers
 *
 * The rows already carry their dates, so a year heading is not new information
 * — it is *structure*, and it earns its place by being the one thing the eye
 * can use to jump. The count beside it is the year's output, which is a real
 * fact about the ledger and the only thing a divider here could honestly say.
 *
 * ## Why there is a thumbnail column
 *
 * The index used to be text on a 5xl column, which left roughly a third of a
 * wide screen empty and gave the writing no imagery at all. The thumbnail is
 * the post's own cover, at a size that stays subordinate to the title — the
 * row is still a row. Posts without a cover simply do not have one; a
 * placeholder in every empty slot would be decoration standing in for content.
 */

/** Posts grouped by publication year, newest year first. */
function byYear(posts: Post[]): { year: string; posts: Post[] }[] {
  const groups = new Map<string, Post[]>();

  for (const post of posts) {
    // Sliced, not parsed: `new Date()` on an instant shifts the day for anyone
    // west of UTC, which would file a 1 January post under the previous year.
    const year = post.published_at?.slice(0, 4) ?? "Drafts";
    const existing = groups.get(year);
    if (existing) existing.push(post);
    else groups.set(year, [post]);
  }

  // Insertion order is the API's order, which is already newest-first, so the
  // years come out newest-first without a second sort.
  return [...groups.entries()].map(([year, entries]) => ({ year, posts: entries }));
}

export function PostLedger({ posts }: { posts: Post[] }) {
  const groups = byYear(posts);

  return (
    <div className="space-y-12">
      {groups.map((group) => (
        <section key={group.year} aria-labelledby={`year-${group.year}`}>
          {/*
            The divider: year on the left, the year's output on the right, one
            hairline between them. `flex` with a growing rule rather than a
            border on the heading, so the line finds its own length whatever
            the year and the count come to.
          */}
          <div className="flex items-center gap-4">
            <Eyebrow as="h2" className="text-foreground" id={`year-${group.year}`}>
              {group.year}
            </Eyebrow>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
            <Eyebrow>
              {group.posts.length} {group.posts.length === 1 ? "note" : "notes"}
            </Eyebrow>
          </div>

          <ul className="mt-2">
            {group.posts.map((post) => (
              <LedgerRow key={post.id} post={post} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LedgerRow({ post }: { post: Post }) {
  const day = isoDay(post.published_at);
  const minutes = readingMinutes(post.body);
  const blurb = post.excerpt ?? summarise(post.body);

  return (
    <li className="group relative border-b border-border/60">
      <div className="grid gap-x-6 gap-y-3 py-7 sm:grid-cols-[6.5rem_minmax(0,1fr)] lg:grid-cols-[6.5rem_minmax(0,1fr)_11rem]">
        {/*
          The meta column. A gutter above `sm`, a single inline row below it,
          where a 6.5rem column would leave the title about twenty characters.

          Hierarchy inside it comes from promoting the date, not from dimming
          what sits under it. Dimming was the first attempt and measured 4.26:1
          on 12px text in dark mode — `--muted-foreground` is already tuned to
          sit just over the line, so any opacity on top of it fails.
        */}
        <div className="flex items-baseline gap-3 sm:flex-col sm:items-start sm:gap-1.5">
          {day ? (
            <time
              dateTime={day}
              className={cn(
                eyebrowClasses,
                // Tracking off, unlike every other eyebrow: this one is a
                // fixed-width figure whose job is to line up with the dates
                // above and below it, and letter-spacing on digits fights that.
                "tracking-normal text-foreground transition-colors group-hover:text-primary group-focus-within:text-primary",
              )}
            >
              {day}
            </time>
          ) : (
            <Eyebrow className="tracking-normal">Draft</Eyebrow>
          )}
          <span className={cn(eyebrowClasses, "tracking-normal")}>{minutes} min</span>

          {post.language !== DEFAULT_LANGUAGE ? (
            /*
              The exception is marked; the rule is not.

              Almost every post here is Vietnamese, and stamping "Tieng Viet" on
              forty rows to make two of them say "English" is forty labels
              carrying no information — the reader learns to skip the line, on
              exactly the rows where it matters. What someone scanning this
              index wants to know is which posts are in the other language, and
              that is what this says. Flip the condition if the balance ever
              changes and neither language is the default one.
            */
            <span
              lang={langAttribute(post.language)}
              className={cn(eyebrowClasses, "tracking-normal text-foreground")}
            >
              {languageFor(post.language).label}
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {post.series ? (
              // The series, before the title, because it is the context the
              // title is read in — "part of Building this" changes what the
              // headline means. Not a link: the whole row is already one, and a
              // link inside a stretched link is unreachable by keyboard.
              <Eyebrow className="text-foreground/70">{post.series.title}</Eyebrow>
            ) : null}
            <NewMark slug={post.slug} publishedAt={post.published_at} />
          </div>

          {/* h3: the page heading is h1 and the year divider is h2. */}
          <h3 className="mt-1 font-display text-lg font-semibold text-foreground sm:text-xl">
            {/*
              Stretched over the whole row — the row is the target, not the
              seven words of the title.
            */}
            <Link
              href={`/blog/${post.slug}`}
              // The title is in the post's language even though the page around
              // it is English, and this is the one attribute that tells a screen
              // reader to switch voice for those seven words.
              lang={langAttribute(post.language)}
              className="transition-colors after:absolute after:inset-0 group-hover:text-primary"
            >
              {post.title}
            </Link>
          </h3>

          <p className="mt-2 max-w-[var(--measure)] text-sm text-muted-foreground">{blurb}</p>

          {post.tags.length > 0 ? (
            /*
              Plain text, not chips. The chips in the rail are controls you can
              press; these are data. Giving them the same treatment would
              promise a filter the row does not offer — and it cannot offer one,
              because the row is already a single stretched link.
            */
            <p className={cn(eyebrowClasses, "mt-3")}>
              {post.tags.map((tag) => tag.name).join(" · ")}
            </p>
          ) : null}
        </div>

        <PostThumb post={post} />
      </div>
    </li>
  );
}

/**
 * The post's cover, small, at the end of the row.
 *
 * Hidden below `lg`, where the row has no width to spare and the title is what
 * matters. Absent entirely when the post has no cover — see the note above.
 */
function PostThumb({ post }: { post: Post }) {
  if (!post.cover_image) return null;

  const shared =
    "hidden h-[6.5rem] w-full overflow-hidden rounded-[var(--radius-control)] border border-border lg:block";

  if (!isOptimisableImage(post.cover_image)) {
    /*
      A CSS background for any URL not in the Blob store. `cover_image` is free
      text — an admin can paste a link to anything — and handing next/image an
      unlisted host throws at render, taking the whole index down for one bad
      string. A background that fails to load simply does not paint: no broken
      image icon, no layout shift, no error handler, and so no client component.
      Same rule as components/ui/project-media.tsx.
    */
    return (
      <div
        aria-hidden="true"
        className={cn(shared, "bg-muted bg-cover bg-center")}
        style={{ backgroundImage: `url(${JSON.stringify(post.cover_image)})` }}
      />
    );
  }

  return (
    <div aria-hidden="true" className={cn(shared, "relative bg-muted")}>
      {/*
        Empty alt and aria-hidden: the row's link already carries the title, and
        a second announcement of the same post is noise to a screen reader.
        `sizes` is the rendered width, so the browser fetches a thumbnail rather
        than the full cover.
      */}
      <Image
        src={post.cover_image}
        alt=""
        fill
        sizes="11rem"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </div>
  );
}
