import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentThread } from "@/components/blog/comment-thread";
import { PostMeta } from "@/components/blog/post-meta";
import { Rating } from "@/components/blog/rating";
import { ReadRecorder } from "@/components/blog/read-recorder";
import { RelatedPosts } from "@/components/blog/related-posts";
import { SeriesNav, SeriesSteps } from "@/components/blog/series-nav";
import { TableOfContents } from "@/components/blog/table-of-contents";
import { Container } from "@/components/ui/container";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { getPost, getPostComments, getPosts, getSeriesPosts } from "@/lib/api";
import { isOptimisableImage } from "@/lib/blob";
import { cn } from "@/lib/cn";
import { hasContents, headingsOf, summarise } from "@/lib/markdown";
import { renderPostBody } from "@/lib/mdx";
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
      tags: post.tags.map((tag) => tag.name),
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);

  // Null covers both a genuine 404 and an API outage. A reader can act on
  // neither, and 404 is the honest answer for "this page has no content" — the
  // outage is distinguishable on the server log.
  if (!post) notFound();

  /*
    Fetched together rather than in sequence. All four are independent, and
    awaited one at a time they would add their latencies — on a cold API that is
    the difference between a page that renders and one that gives up.

    Every one of these has a fallback, so a failure in any of them costs that
    section and not the post.

    The rating is deliberately not among them: it depends on who is asking, and
    reading the visitor's headers here would make every post page render per
    request instead of being prerendered. The stars fetch themselves.
  */
  const [body, comments, allPosts, seriesPosts] = await Promise.all([
    renderPostBody(post.body, post.format),
    getPostComments(post.id),
    getPosts(),
    post.series ? getSeriesPosts(post.series.slug) : Promise.resolve([]),
  ]);

  const headings = headingsOf(post.body);
  // Which margins have anything to hold. See the grid below.
  const contents = hasContents(headings);
  const aside = Boolean(post.series && seriesPosts.length > 1);

  return (
    <>
      {/*
        How far through the post you are, as a spine segment drawing down the
        left edge — the same line the home page's sections dock onto. z-50 puts
        it over the nav's own z-40.

        Scroll-driven CSS: no client component, no scroll listener. See
        `.reading-progress-y` in globals.css for why it is behind a `@supports`
        and a reduced-motion guard, and what it does without them — nothing,
        which is the correct amount for a decoration.
      */}
      <div aria-hidden="true" className="fixed inset-y-0 left-0 z-50 w-0.5">
        <div className="reading-progress-y h-full w-full bg-signal" />
      </div>

      <ReadRecorder slug={post.slug} title={post.title} />

      <article className="py-14 sm:py-20">
        <Container width="layout">
          <Link
            href="/blog"
            className={cn(
              eyebrowClasses,
              "inline-flex min-h-11 items-center transition-colors hover:text-primary",
            )}
          >
            ← All posts
          </Link>

          <header className="mt-8 max-w-3xl">
            {post.series ? (
              <Eyebrow className="mb-3">
                <Link
                  href={`/blog/series/${post.series.slug}`}
                  className="inline-flex min-h-11 items-center transition-colors hover:text-primary lg:min-h-0"
                >
                  {post.series.title}
                </Link>
              </Eyebrow>
            ) : null}

            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {post.title}
            </h1>

            {post.excerpt ? (
              <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>
            ) : null}

          </header>

          <Cover post={post} />

          {/*
            The left rail always has something in it — the post's own facts, and
            its contents when there are enough headings to navigate. That is
            what makes a fixed column safe here: a column reserved for a
            component that returns null is 13rem of empty gutter, which is
            exactly what this layout had until a screenshot showed it.

            The right rail is the one that comes and goes, so it is the one the
            grid is conditional on.
          */}
          <div
            className={cn(
              "mt-12 grid items-start gap-x-10 gap-y-10 lg:grid-cols-[13rem_minmax(0,1fr)]",
              aside && "xl:grid-cols-[13rem_minmax(0,42rem)_minmax(0,1fr)]",
            )}
          >
            <div className="lg:sticky lg:top-24">
              <PostMeta post={post} />
              {contents ? (
                <div className="mt-8 hidden lg:block">
                  <TableOfContents headings={headings} />
                </div>
              ) : null}
            </div>

            <div className="min-w-0 max-w-[42rem]">
              {body.problem ? (
                /*
                  Shown to everyone, not just the author. A post whose MDX did
                  not compile is rendering as Markdown, which means component
                  tags are visible as text — the reader can see something is
                  wrong, so saying so is less confusing than pretending.
                */
                <Notice tone="error" className="mb-8">
                  This post did not render as intended, so it is shown as plain
                  Markdown.
                </Notice>
              ) : null}

              {/*
                Rendered directly — `renderPostBody` already put `article-prose`
                on the element holding the markup. Wrapping it in another div
                with the class puts one element between the class and the
                content, and every rule in that stylesheet is a direct-child
                selector. See lib/mdx.tsx.
              */}
              {body.content}

              {post.series && seriesPosts.length > 0 ? (
                <SeriesSteps posts={seriesPosts} currentSlug={post.slug} />
              ) : null}

              <div className="mt-12">
                <Rating postId={post.id} />
              </div>

              <RelatedPosts post={post} posts={allPosts} />

              <CommentThread postId={post.id} comments={comments} />
            </div>

            {aside && post.series ? (
              <aside className="hidden xl:block">
                {/*
                  `ml-auto` with a cap: the column absorbs whatever width is
                  left over, and the card hugs the container's right edge rather
                  than floating in the middle of it. The title above starts at
                  the left edge, so the page is anchored at both.
                */}
                <div className="ml-auto max-w-[16rem] space-y-6 xl:sticky xl:top-24">
                  <SeriesNav
                    series={post.series}
                    posts={seriesPosts}
                    currentSlug={post.slug}
                  />
                </div>
              </aside>
            ) : null}
          </div>

          <footer className="mt-14 border-t border-border pt-6">
            <Link
              href="/blog"
              className={cn(
              eyebrowClasses,
              "inline-flex min-h-11 items-center transition-colors hover:text-primary",
            )}
            >
              ← All posts
            </Link>
          </footer>
        </Container>
      </article>
    </>
  );
}

/**
 * The cover, wider than the prose it introduces.
 *
 * The one place a post is allowed to be as wide as the page. Colour on this
 * site comes from the work rather than the chrome, and a cover image is the
 * work — so it gets the full measure while the text keeps a readable one.
 *
 * A fixed aspect ratio because the API does not send dimensions for a pasted
 * URL, and a cover that reflows the article as it loads is worse than one
 * cropped. Empty alt: there is no alt-text field on a post to fill it from, and
 * an invented description is worse than none.
 */
function Cover({ post }: { post: { cover_image: string | null; title: string } }) {
  if (!post.cover_image) return null;

  const shape =
    "mt-10 aspect-[21/9] w-full overflow-hidden rounded-[var(--radius-card)] border border-border";

  if (!isOptimisableImage(post.cover_image)) {
    // Any host but the Blob store: painted as a background, so a URL that no
    // longer resolves simply does not paint. Handing it to next/image throws at
    // render and takes the post down for one bad string.
    return (
      <div
        aria-hidden="true"
        className={cn(shape, "bg-muted bg-cover bg-center")}
        style={{ backgroundImage: `url(${JSON.stringify(post.cover_image)})` }}
      />
    );
  }

  return (
    <div className={cn(shape, "relative bg-muted")}>
      <Image
        src={post.cover_image}
        alt=""
        fill
        // Full width up to the layout container's 80rem cap.
        sizes="(min-width: 1280px) 76rem, 100vw"
        priority
        className="object-cover"
      />
    </div>
  );
}
