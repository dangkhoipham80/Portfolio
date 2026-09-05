import Link from "next/link";

import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { isoDay } from "@/lib/format";
import { readingMinutes } from "@/lib/markdown";
import type { Post } from "@/lib/types";

/**
 * Other posts on the same subjects.
 *
 * ## How "related" is decided
 *
 * By counting shared tags, and nothing cleverer. There is no embedding, no
 * similarity model and no "readers also viewed" — with tens of posts, shared
 * tags *is* the relationship, and anything statistical would be inventing
 * signal from a sample too small to have any.
 *
 * Ties break on recency, which is the honest second key: given two posts
 * equally related, the newer one is more likely to still be true.
 *
 * ## Why it renders nothing rather than falling back to "latest posts"
 *
 * A related list that quietly becomes a recent list is lying about what it is.
 * If a post shares no tags with anything, the honest answer is that there is
 * nothing related, and the reader still has the whole index one link away.
 */
export function RelatedPosts({
  post,
  posts,
  limit = 3,
}: {
  post: Post;
  /** Every published post; this component does the filtering. */
  posts: Post[];
  limit?: number;
}) {
  const mine = new Set(post.tags.map((tag) => tag.slug));
  if (mine.size === 0) return null;

  /*
    This post, and the same writing in another language.

    A translation carries its original's tags, so it scores as the most related
    thing on the site to the post it *is* — and it would be offered as further
    reading directly under a switcher that already offers it, which reads as a
    suggestion to read the article again.
  */
  const same = new Set([post.slug, ...post.translations.map((other) => other.slug)]);

  const related = posts
    .filter((candidate) => !same.has(candidate.slug))
    .map((candidate) => ({
      post: candidate,
      shared: candidate.tags.filter((tag) => mine.has(tag.slug)).length,
    }))
    .filter((entry) => entry.shared > 0)
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        // `localeCompare` on the ISO instants rather than parsing them: the
        // format sorts lexicographically, and Date.parse on a null would be a
        // NaN comparison that silently keeps the original order.
        (b.post.published_at ?? "").localeCompare(a.post.published_at ?? ""),
    )
    .slice(0, limit);

  if (related.length === 0) return null;

  return (
    // No top margin of its own: this sits in a rail that spaces its own
    // children, and a margin here would only be right in one of the two places
    // that rail renders.
    <section aria-labelledby="related-heading">
      <div className="flex items-center gap-4">
        <Eyebrow as="h2" id="related-heading" className="text-foreground">
          Related
        </Eyebrow>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>

      {/*
        Three across when this sits in the article's flow, one above the next
        when it sits in the right rail at `xl` — same three cards, laid out for
        the width they are given rather than duplicated for it.
      */}
      <ul className="mt-4 grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
        {related.map(({ post: entry, shared }) => (
          <li key={entry.slug}>
            <Link
              href={`/blog/${entry.slug}`}
              className={cn(
                "group flex h-full flex-col rounded-[var(--radius-card)] border border-border p-4 transition-colors hover:border-foreground/30 hover:bg-muted",
              )}
            >
              <span className={cn(eyebrowClasses, "tracking-normal")}>
                {isoDay(entry.published_at) ?? "Draft"} · {readingMinutes(entry.body)} min
              </span>
              <span className="mt-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                {entry.title}
              </span>
              {/*
                Says *why* it is here. "Related" on its own is an assertion the
                reader has to take on trust; the shared subjects are the reason,
                and they are a fact.
              */}
              <span className={cn(eyebrowClasses, "mt-auto pt-3")}>
                {entry.tags
                  .filter((tag) => mine.has(tag.slug))
                  .slice(0, 2)
                  .map((tag) => tag.name)
                  .join(" · ")}
                {shared > 2 ? ` +${shared - 2}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
