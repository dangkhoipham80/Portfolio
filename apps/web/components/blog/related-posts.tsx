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

  const related = posts
    .filter((candidate) => candidate.slug !== post.slug)
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
    <section aria-labelledby="related-heading" className="mt-16">
      <div className="flex items-center gap-4">
        <Eyebrow as="h2" id="related-heading" className="text-foreground">
          Related
        </Eyebrow>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>

      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
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
