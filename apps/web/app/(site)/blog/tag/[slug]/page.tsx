import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogIndexShell } from "@/components/blog/index-shell";
import { getPosts, getSeriesList, getTag, getTags } from "@/lib/api";
import { pageFrom, paginate } from "@/lib/blog-index";
import { absoluteUrl } from "@/lib/site";

/**
 * A subject's own page.
 *
 * This used to be `/blog?tag=Tailwind`, which had two problems that the tags
 * table exists to fix: the URL was the display name, so it broke the moment the
 * spelling changed, and there was nowhere to put a sentence saying what the
 * subject is. Both are now real fields on a real row.
 */

export async function generateMetadata({
  params,
}: PageProps<"/blog/tag/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTag(slug);

  if (!tag) return { title: "Tag not found" };

  const description =
    tag.description ?? `Posts filed under ${tag.name} — ${tag.post_count} so far.`;

  return {
    title: `${tag.name} — Writing`,
    description,
    alternates: { canonical: absoluteUrl(`/blog/tag/${tag.slug}`) },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: PageProps<"/blog/tag/[slug]">) {
  const { slug } = await params;
  const page = pageFrom((await searchParams).page);

  const [tag, posts, tags, series] = await Promise.all([
    getTag(slug),
    getPosts(),
    getTags(),
    getSeriesList(),
  ]);

  // Null covers a genuine 404 and an API outage alike. A reader can act on
  // neither, and 404 is the honest answer for "this page has no content" — the
  // outage is distinguishable on the server log.
  if (!tag) notFound();

  const matching = posts.filter((post) =>
    post.tags.some((entry) => entry.slug === tag.slug),
  );

  return (
    <BlogIndexShell
      eyebrow={`/writing/${tag.slug} · ${matching.length}`}
      title={tag.name}
      description={tag.description ?? undefined}
      tags={tags}
      series={series}
      totalPosts={posts.length}
      activeTag={tag.slug}
      paged={paginate(matching, page)}
      hrefFor={(next) =>
        next > 1 ? `/blog/tag/${tag.slug}?page=${next}` : `/blog/tag/${tag.slug}`
      }
      emptyMessage={`Nothing filed under ${tag.name} yet.`}
    />
  );
}
