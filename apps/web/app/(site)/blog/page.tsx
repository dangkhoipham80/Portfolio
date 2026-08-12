import type { Metadata } from "next";

import { PostRow } from "@/components/post-row";
import { EmptyState, Section } from "@/components/section";
import { TagFilter } from "@/components/tag-filter";
import { getPosts } from "@/lib/api";

export const metadata: Metadata = {
  title: "Writing",
  description:
    "Notes on what I built, what broke, and what the fix turned out to be.",
  alternates: {
    types: { "application/rss+xml": "/blog/feed.xml" },
  },
};

/** Every tag in use, most-used first, so the facets lead with the real subjects. */
function facetsOf(posts: { tags: string[] }[]): string[] {
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const { tag } = await searchParams;
  // An array means the query string had `?tag=` twice. Take the first rather
  // than rendering "a,b" as though it were a tag anyone could have.
  const active = Array.isArray(tag) ? tag[0] : tag;

  const posts = await getPosts();
  const shown = active ? posts.filter((post) => post.tags.includes(active)) : posts;

  return (
    <Section
      level="h1"
      width="wide"
      eyebrow={`/writing · ${posts.length}`}
      title="Notes from building this"
      description="What I built, what broke, and what the fix turned out to be. Mostly backend, occasionally CSS."
    >
      <TagFilter tags={facetsOf(posts)} active={active} />

      {shown.length === 0 ? (
        <div className="mt-8">
          <EmptyState>
            {active
              ? `Nothing tagged ${active} yet.`
              : "No posts published yet."}
          </EmptyState>
        </div>
      ) : (
        // border-t so the first row has a rule above it and the list reads as
        // a set of entries rather than as text that happens to have lines under
        // it. Each row supplies its own border-b.
        <ul className="mt-8 border-t border-border/60">
          {shown.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </ul>
      )}
    </Section>
  );
}
