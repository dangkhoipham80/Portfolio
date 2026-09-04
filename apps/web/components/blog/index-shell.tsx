import type { ReactNode } from "react";

import { ContinueReading } from "@/components/blog/continue-reading";
import { FilterRail } from "@/components/blog/filter-rail";
import { VisitRecorder } from "@/components/blog/new-mark";
import { PostLedger } from "@/components/blog/post-ledger";
import { Pagination } from "@/components/blog/pagination";
import { EmptyState } from "@/components/section";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { Paged } from "@/lib/blog-index";
import type { Post, Series, Tag } from "@/lib/types";

/**
 * The frame the index, the tag pages and the series pages all share.
 *
 * Three pages, one layout, because they are the same screen with a different
 * question at the top — and writing them out separately is how the rail ends up
 * on two of them and the pagination on one.
 *
 * ## Two columns, not three
 *
 * Controls on the left, results filling everything else. The old index was a
 * single centred column that left a third of a wide screen empty on either
 * side, and the fix is not to stretch the prose — a blurb wants a reading
 * measure — but to give the margin something that belongs in a margin.
 *
 * There was a third column for a while, holding this browser's reading history.
 * It looked right in the plan and wrong on the screen: it renders nothing for a
 * first-time visitor, which is most visitors, so at 1440px it was 224px of
 * reserved emptiness on a page whose whole complaint had been reserved
 * emptiness. The history moved into the left rail, under the other controls,
 * where it costs nothing when it is empty. Measured, not guessed — the column
 * was there until a screenshot at 1440 showed what it was doing.
 */
export function BlogIndexShell({
  eyebrow,
  title,
  description,
  tags,
  series,
  totalPosts,
  activeTag,
  activeSeries,
  query,
  paged,
  hrefFor,
  emptyMessage,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  tags: Tag[];
  series: Series[];
  /** Every published post, for the rail's "Everything" count. */
  totalPosts: number;
  activeTag?: string;
  activeSeries?: string;
  query?: string;
  paged: Paged<Post>;
  hrefFor: (page: number) => string;
  emptyMessage: string;
  /** Anything between the header and the ledger — a series' standfirst, say. */
  children?: ReactNode;
}) {
  return (
    <div className="py-14 sm:py-20">
      <Container width="full">
        <header className="max-w-3xl">
          <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-[var(--measure)] text-lg text-muted-foreground">{description}</p>
          ) : null}
        </header>

        {children}

        {/*
          `items-start` so each column scrolls on its own and the sticky rails
          actually stick — a stretched grid item is as tall as the row, and
          `position: sticky` inside one has nowhere to travel.
        */}
        <div className="mt-12 grid items-start gap-x-12 gap-y-12 lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)] xl:gap-x-20">
          <div className="lg:sticky lg:top-24">
            <FilterRail
              tags={tags}
              series={series}
              totalPosts={totalPosts}
              activeTag={activeTag}
              activeSeries={activeSeries}
              query={query}
            />
            <ContinueReading />
          </div>

          <main>
            {paged.items.length === 0 ? (
              <EmptyState>{emptyMessage}</EmptyState>
            ) : (
              <>
                <PostLedger posts={paged.items} />
                <Pagination
                  page={paged.page}
                  pageCount={paged.pageCount}
                  hrefFor={hrefFor}
                />
              </>
            )}
          </main>
        </div>
      </Container>

      {/* Records the visit *after* the marks above have read the old value. */}
      <VisitRecorder />
    </div>
  );
}
