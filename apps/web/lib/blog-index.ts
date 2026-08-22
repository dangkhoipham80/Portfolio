import type { Post } from "./types";

/**
 * Narrowing the index: search, then pages.
 *
 * ## Why this happens here and not on the API
 *
 * The API takes a `q` and a `tag`, and the index deliberately does not use
 * them. It has to know every tag that exists in order to draw the facets *and*
 * their counts, and a response already filtered to one search term cannot tell
 * it about the others — so the page fetches the whole list once, cached, and
 * narrows it itself. One request serves the facets, the search, the pagination
 * and the year groups.
 *
 * That holds because a portfolio's blog is tens of posts. The read that would
 * make it wrong is a body-text search over thousands, and at that size the
 * facets would have to move server-side anyway. Both are the same change, and
 * it is not this one.
 *
 * Plain functions with no imports beyond the type, so they are testable without
 * a server, a fetch or a fixture.
 */

/** How many rows a page of the ledger holds. */
export const PAGE_SIZE = 12;

/**
 * Posts matching a search term.
 *
 * Title, excerpt, tag names and body, case-insensitively, on the whole term
 * rather than word by word. Substring rather than tokens is the honest choice
 * at this scale: a reader searching "rate limit" means the phrase, and
 * splitting it would return every post mentioning either word and rank none of
 * them.
 *
 * An empty or whitespace-only term returns everything, so a submitted-but-empty
 * search box does not read as "no results".
 */
export function searchPosts(posts: Post[], term: string | undefined): Post[] {
  const needle = term?.trim().toLowerCase();
  if (!needle) return posts;

  return posts.filter((post) => {
    const haystack = [
      post.title,
      post.excerpt ?? "",
      post.body,
      // Tag *names*, not slugs: someone searching "Next.js" should find posts
      // filed under it, and the slug is "next-js".
      ...post.tags.map((tag) => tag.name),
      post.series?.title ?? "",
    ]
      .join("\n")
      .toLowerCase();

    return haystack.includes(needle);
  });
}

export type Paged<T> = {
  items: T[];
  /** 1-based, and always within range — see `pageFrom`. */
  page: number;
  pageCount: number;
  total: number;
};

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE): Paged<T> {
  // At least one page even when there is nothing, so "page 1 of 1" is what an
  // empty result says rather than "page 1 of 0".
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;

  return {
    items: items.slice(start, start + size),
    page: current,
    pageCount,
    total: items.length,
  };
}

/**
 * The page number a query string is asking for.
 *
 * Anything that is not a positive integer becomes 1. The value comes from the
 * URL, so it is whatever a visitor typed — `?page=-4`, `?page=NaN`, `?page[]=1`
 * — and every one of those has to land somewhere sensible rather than slicing
 * an array with a negative index.
 */
export function pageFrom(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** The first value of a repeated query parameter, or undefined. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
