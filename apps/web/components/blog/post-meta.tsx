import Link from "next/link";

import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { formatFullDate, isoDay } from "@/lib/format";
import { readingMinutes } from "@/lib/markdown";
import type { Post } from "@/lib/types";

/**
 * A post's facts, in the left gutter.
 *
 * ## Why the gutter and not a strip under the title
 *
 * It was a strip under the title, and the gutter beside it held the table of
 * contents — which meant that on a post with fewer than three headings the
 * column was reserved and empty, and the page had 13rem of nothing down its
 * left side. Two fixes were possible: stop reserving the column, or give it
 * something that is always there. This is the second, and it is the better one,
 * because the meta genuinely belongs beside the article rather than in front of
 * it. The date and the reading time are things you check while deciding whether
 * to keep going, not things you read first.
 *
 * Below `lg` the rail stacks above the prose, which puts it back exactly where
 * it used to be. Nothing is duplicated and nothing is hidden — it is one
 * element in two places in the flow.
 */
export function PostMeta({ post }: { post: Post }) {
  const day = isoDay(post.published_at);

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-5 border-b border-border pb-6 lg:flex-col lg:border-b-0 lg:pb-0">
      {day ? (
        <div>
          <Eyebrow className="mb-1">Published</Eyebrow>
          <time dateTime={day} className="text-sm text-foreground">
            {formatFullDate(post.published_at)}
          </time>
        </div>
      ) : null}

      <div>
        <Eyebrow className="mb-1">Reading</Eyebrow>
        <p className="text-sm text-foreground">{readingMinutes(post.body)} min</p>
      </div>

      {post.tags.length > 0 ? (
        <div>
          <Eyebrow className="mb-1">Filed under</Eyebrow>
          {/*
            Real links, unlike the same tags on the index — there the whole row
            is one stretched link and a link inside it would be unreachable by
            keyboard. Here there is no outer link to nest in.
          */}
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5 lg:flex-col">
            {post.tags.map((tag) => (
              <li key={tag.slug}>
                <Link
                  href={`/blog/tag/${tag.slug}`}
                  className={cn(
                    "inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors lg:min-h-8",
                    "hover:text-foreground",
                  )}
                >
                  {tag.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {post.format === "mdx" ? (
        /*
          Only shown for MDX, and only because it is true and mildly
          interesting on a blog whose subject is how the site is built. A
          "Markdown" label on every other post would be noise.
        */
        <div className="hidden lg:block">
          <Eyebrow className="mb-1">Written in</Eyebrow>
          <p className={cn(eyebrowClasses, "tracking-normal text-foreground")}>MDX</p>
        </div>
      ) : null}
    </div>
  );
}
