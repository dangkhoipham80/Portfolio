import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogIndexShell } from "@/components/blog/index-shell";
import { getPosts, getSeries, getSeriesList, getSeriesPosts, getTags } from "@/lib/api";
import { pageFrom, paginate } from "@/lib/blog-index";
import { absoluteUrl } from "@/lib/site";

/**
 * A series' own page.
 *
 * The one listing on the site that reads oldest-first, and the ledger's year
 * dividers still apply — a series written over two years genuinely is two
 * years' work, and hiding that would be tidier and less true. The API decides
 * the order; this page does not re-sort it.
 */

export async function generateMetadata({
  params,
}: PageProps<"/blog/series/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeries(slug);

  if (!series) return { title: "Series not found" };

  return {
    title: `${series.title} — Writing`,
    description: series.description ?? `A series in ${series.post_count} parts.`,
    alternates: { canonical: absoluteUrl(`/blog/series/${series.slug}`) },
  };
}

export default async function SeriesPage({
  params,
  searchParams,
}: PageProps<"/blog/series/[slug]">) {
  const { slug } = await params;
  const page = pageFrom((await searchParams).page);

  const [series, posts, tags, allSeries, everything] = await Promise.all([
    getSeries(slug),
    getSeriesPosts(slug),
    getTags(),
    getSeriesList(),
    // For the rail's "Everything" count only. `posts` here is this series' run,
    // and using it would label the way back to the whole index with the number
    // of parts in the series you are already looking at.
    getPosts(),
  ]);

  if (!series) notFound();

  return (
    <BlogIndexShell
      eyebrow={`/writing/series · ${posts.length} ${posts.length === 1 ? "part" : "parts"}`}
      title={series.title}
      description={series.description ?? undefined}
      tags={tags}
      series={allSeries}
      totalPosts={everything.length}
      activeSeries={series.slug}
      paged={paginate(posts, page)}
      hrefFor={(next) =>
        next > 1 ? `/blog/series/${series.slug}?page=${next}` : `/blog/series/${series.slug}`
      }
      emptyMessage="No parts of this series are published yet."
    />
  );
}
