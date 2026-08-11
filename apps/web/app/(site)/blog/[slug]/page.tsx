import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/ui/container";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { getPost, getPosts } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatFullDate, isoDay } from "@/lib/format";
import { readingMinutes, renderMarkdown, summarise } from "@/lib/markdown";
import { absoluteUrl } from "@/lib/site";

/**
 * Pre-render the published posts at build time. Anything published after the
 * last deploy still renders on demand and is then cached, so writing a post
 * does not need a redeploy — same arrangement as the project pages.
 */
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) return { title: "Post not found" };

  const description = post.excerpt ?? summarise(post.body);

  return {
    title: post.title,
    description,
    alternates: { canonical: absoluteUrl(`/blog/${post.slug}`) },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url: absoluteUrl(`/blog/${post.slug}`),
      // The instant, not the day: Open Graph wants ISO 8601 and consumers use
      // it for ordering, where a date alone puts everything at midnight.
      publishedTime: post.published_at ?? undefined,
      tags: post.tags,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  };
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className={eyebrowClasses}>{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </>
  );
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);

  // Null covers both a genuine 404 and an API outage. A reader can act on
  // neither, and 404 is the honest answer for "this page has no content" — the
  // outage is distinguishable on the server log.
  if (!post) notFound();

  const html = await renderMarkdown(post.body);
  const day = isoDay(post.published_at);

  return (
    <>
      {/*
        How far through the post you are. Fixed to the top of the viewport
        rather than pinned under the header, so it does not depend on the
        header's height; z-50 puts it over the nav's own z-40.

        The fill is scroll-driven CSS — no client component, no scroll
        listener. See `.reading-progress` in globals.css for why it is behind
        a `@supports` and a reduced-motion guard, and what it does without
        them: nothing, which is the correct amount for a decoration.
      */}
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-0.5">
        <div className="reading-progress h-full w-full bg-primary" />
      </div>

      <article className="py-14 sm:py-20">
        <Container width="reading">
          <Link
            href="/blog"
            className={cn(eyebrowClasses, "transition-colors hover:text-primary")}
          >
            ← All posts
          </Link>

          <header className="mt-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {post.title}
            </h1>

            {/*
              The post's fields, as fields. A description list is the honest
              markup for label/value pairs, and the two-column grid is the same
              device the footer uses for its contact channels — a label column
              sized to the longest label, so adding a row cannot break the
              alignment.
            */}
            <dl className="mt-6 grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 border-y border-border py-4">
              {day ? (
                <MetaRow label="Published">
                  <time dateTime={day}>{formatFullDate(post.published_at)}</time>
                </MetaRow>
              ) : null}

              <MetaRow label="Reading">{readingMinutes(post.body)} min</MetaRow>

              {post.tags.length > 0 ? (
                <MetaRow label="Tags">{post.tags.join(" · ")}</MetaRow>
              ) : null}
            </dl>
          </header>

          {post.cover_image ? (
            /*
              A plain <img>, not next/image. The URL comes from the API and can
              point at any host, and next/image refuses anything not listed in
              `remotePatterns` — so using it here would mean either a redeploy
              every time a cover is hosted somewhere new, or a wildcard, which
              turns the site's image optimiser into an open proxy.

              Fixed aspect ratio because the API does not send dimensions and a
              cover that reflows the article on load is worse than one cropped.
              Empty alt: there is no alt-text field to fill it from, and an
              invented description is worse than none.
            */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.cover_image}
              alt=""
              loading="lazy"
              className="mt-10 aspect-[2/1] w-full rounded-[var(--radius-card)] border border-border object-cover"
            />
          ) : null}

          {/*
            Sanitised in lib/markdown.ts, which is the only reason this is safe.
            The API stores Markdown verbatim and never escapes anything.
          */}
          <div
            className="article-prose mt-10"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <footer className="mt-14 border-t border-border pt-6">
            <Link
              href="/blog"
              className={cn(eyebrowClasses, "transition-colors hover:text-primary")}
            >
              ← All posts
            </Link>
          </footer>
        </Container>
      </article>
    </>
  );
}
