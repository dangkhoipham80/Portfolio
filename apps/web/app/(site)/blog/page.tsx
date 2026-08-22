import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BlogIndexShell } from "@/components/blog/index-shell";
import { getPosts, getSeriesList, getTags } from "@/lib/api";
import { firstParam, pageFrom, paginate, searchPosts } from "@/lib/blog-index";

export const metadata: Metadata = {
  title: "Writing",
  description:
    "Notes on what I built, what broke, and what the fix turned out to be.",
  alternates: {
    types: { "application/rss+xml": "/blog/feed.xml" },
  },
};

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const params = await searchParams;
  const tag = firstParam(params.tag);

  // `?tag=` was how facets worked before tags were rows and had pages of their
  // own. Anything already published pointing at it still resolves rather than
  // silently showing an unfiltered index.
  if (tag) redirect(`/blog/tag/${encodeURIComponent(tag)}`);

  const query = firstParam(params.q);
  const page = pageFrom(params.page);

  const [posts, tags, series] = await Promise.all([
    getPosts(),
    getTags(),
    getSeriesList(),
  ]);

  const matching = searchPosts(posts, query);
  const paged = paginate(matching, page);

  return (
    <BlogIndexShell
      eyebrow={query ? `/writing · ${matching.length} matching` : `/writing · ${posts.length}`}
      title={query ? `Posts mentioning “${query}”` : "Notes from building this"}
      description={
        query
          ? undefined
          : "What I built, what broke, and what the fix turned out to be. Mostly backend, occasionally CSS."
      }
      tags={tags}
      series={series}
      totalPosts={posts.length}
      query={query}
      paged={paged}
      hrefFor={(next) => hrefFor(query, next)}
      emptyMessage={
        query
          ? `Nothing here mentions “${query}”. Try a shorter phrase, or pick a subject on the left.`
          : "No posts published yet."
      }
    />
  );
}

/** Page links keep the search term, or the reader loses it on page two. */
function hrefFor(query: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));

  const search = params.toString();
  return search ? `/blog?${search}` : "/blog";
}
