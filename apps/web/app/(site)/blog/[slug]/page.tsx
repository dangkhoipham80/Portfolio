// KaTeX's own stylesheet. Route-scoped rather than global: it is 23kB plus a
// font family, and this is the only public page that can contain a formula.
// Next resolves the font URLs inside it, which is why it is imported here as a
// module rather than `@import`-ed into globals.css — that would flatten the
// text into a stylesheet in another directory and leave the fonts 404ing.
import "katex/dist/katex.min.css";

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
import { TranslationSwitcher } from "@/components/blog/translation-switcher";
import { Container } from "@/components/ui/container";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { getPost, getPostComments, getPosts, getSeriesPosts } from "@/lib/api";
import { isOptimisableImage } from "@/lib/blob";
import { cn } from "@/lib/cn";
import { langAttribute } from "@/lib/languages";
import { hasContents, headingsOf, summarise } from "@/lib/markdown";
import { renderPostBody } from "@/lib/mdx";
import { absoluteUrl, SITE_AUTHOR } from "@/lib/site";

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
    alternates: {
      canonical: absoluteUrl(`/blog/${post.slug}`),
      /*
        `hreflang`, built from the versions the API says this caller may see.

        Each version includes itself in the map as well as its siblings, which
        is what the specification asks for — a set of alternates that does not
        list the page carrying it is a one-way reference, and search engines
        treat the group as unconfirmed. So the entry for this post's own
        language points at this post.
      */
      languages: {
        [langAttribute(post.language)]: absoluteUrl(`/blog/${post.slug}`),
        ...Object.fromEntries(
          post.translations.map((other) => [
            langAttribute(other.language),
            absoluteUrl(`/blog/${other.slug}`),
          ]),
        ),
      },
    },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      locale: langAttribute(post.language),
      url: absoluteUrl(`/blog/${post.slug}`),
      // The instant, not the day: Open Graph wants ISO 8601 and consumers use
      // it for ordering, where a date alone puts everything at midnight.
      publishedTime: post.published_at ?? undefined,
      authors: [post.author_name ?? SITE_AUTHOR],
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
  const contents = hasContents(headings);
  const series = Boolean(post.series && seriesPosts.length > 1);

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

      {/*
        The whole width, like the home page. The post used to sit in the 7xl
        box with its prose capped at 42rem, which at 1440px left a third of
        the screen empty on the right — the owner's verdict was the same one
        the home page got: not full. Now the rail takes the left, the article
        takes the rest, and the rest is most of it.

        The header arrives on the hero's clock — `hero-item`, staggered top to
        bottom — so opening a post has the same boot sequence as opening the
        site. Everything below the fold arrives on the reader's own scroll
        instead; see `.article-prose > *` in globals.css.
      */}
      <article className="py-12 sm:py-16">
        <Container width="full">
          <Link
            href="/blog"
            className={cn(
              eyebrowClasses,
              "hero-item inline-flex min-h-11 items-center transition-colors hover:text-primary",
            )}
          >
            ← All posts
          </Link>

          {/*
            `lang` here and on the body below, rather than on the `<article>` or
            the document.

            It has to be narrow. The shell, the nav, "← All posts", "Related"
            and "Was this useful?" are English whatever the post is written in,
            and a `lang="vi"` covering all of them would have a screen reader
            read the site's own chrome with Vietnamese phonology — which is the
            same bug as not marking the post at all, pointed the other way. What
            is marked is what is true: the title, the standfirst, and the body.
          */}
          <header lang={langAttribute(post.language)} className="mt-6 max-w-4xl">
            {post.series ? (
              <Eyebrow className="hero-item mb-3 [animation-delay:80ms]">
                <Link
                  href={`/blog/series/${post.series.slug}`}
                  className="inline-flex min-h-11 items-center transition-colors hover:text-primary lg:min-h-0"
                >
                  {post.series.title}
                </Link>
              </Eyebrow>
            ) : null}

            <h1 className="hero-item font-display text-3xl font-bold tracking-tight text-foreground [animation-delay:120ms] sm:text-4xl lg:text-[3.25rem] lg:leading-[1.05]">
              {post.title}
            </h1>

            {post.excerpt ? (
              <p className="hero-item mt-5 max-w-[var(--measure)] text-lg text-muted-foreground [animation-delay:220ms] sm:text-xl">
                {post.excerpt}
              </p>
            ) : null}
          </header>

          {/*
            Under the title, where a reader who opened the wrong language finds
            it before reading a paragraph of it — rather than in a rail, which
            on a phone is above the title and on a desktop is a column they have
            no reason to have looked at yet. On the header's own clock, one beat
            after the standfirst.
          */}
          <TranslationSwitcher
            post={post}
            className="hero-item mt-6 [animation-delay:260ms]"
          />

          <div className="hero-item [animation-delay:300ms]">
            <Cover post={post} />
          </div>

          {/*
            One rail and one column, and the column gets everything else.

            This was three columns: a rail, a fixed 48rem article, and a right
            rail holding the series nav, the rating and the related posts. That
            arrangement filled the empty strip down the right, which is what it
            was for — but it filled it with furniture, and left the article
            capped at a width the article's own contents did not fit in. A
            five-column table of ETF fees wants 1340px. It had 768, and scrolled
            sideways, with a star control sitting in the room it needed.

            So the furniture moves back under the article, in the order a reader
            meets it: the writing, then what it was part of, then "was this
            useful", then the discussion, then what to read next. The column is
            now the whole remainder, and the measure is enforced on the text
            rather than on the column — paragraphs keep the same 48rem line they
            had, tables and diagrams get the rest. That split lives in
            `.article-prose` in globals.css.

            The rail keeps what orients a reader: the post's own facts, the
            series it belongs to, and its contents.

            Two grid children, so the sticky rail keeps its grip to the foot of
            the page for free — everything after the article is inside the
            second child rather than in rows of its own, and a grid item can
            only stick within its own area.
          */}
          <div className="mt-12 grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)] xl:grid-cols-[minmax(13rem,15rem)_minmax(0,1fr)] xl:gap-x-10">
            <div className="hero-item space-y-8 [animation-delay:380ms] lg:sticky lg:top-24">
              <PostMeta post={post} />

              {/*
                The whole run of the series, in the rail rather than under the
                article — it is orientation for someone who arrived at part 3
                from a search result, so it has to be readable before the post
                is, not after. `SeriesSteps` at the foot is the other half:
                previous and next, where the reader who finished is looking.
              */}
              {series && post.series ? (
                <SeriesNav
                  series={post.series}
                  posts={seriesPosts}
                  currentSlug={post.slug}
                />
              ) : null}

              {contents ? (
                <div className="hidden lg:block">
                  <TableOfContents headings={headings} />
                </div>
              ) : null}
            </div>

            {/*
              No measure on this column any more — it is the width the rail
              leaves, and the cap has moved inside, onto the text. 48rem at 17px
              is ~82 characters, past the reading-measure rule's 80 and on
              purpose, because this article also holds code; the tokens carrying
              it are in globals.css. What stays here is the type, which steps up
              at 2xl along with the measure so the line keeps its length in
              characters while the column uses more of the room it has.
            */}
            <div className="hero-item min-w-0 text-[1.0625rem] [animation-delay:440ms] lg:col-start-2 lg:row-start-1 2xl:text-lg">
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
              <div lang={langAttribute(post.language)}>{body.content}</div>

              {post.series && seriesPosts.length > 0 ? (
                <SeriesSteps posts={seriesPosts} currentSlug={post.slug} />
              ) : null}

              {/*
                Held to the measure rather than the column. Five stars and a
                distribution of five bars stretched across the full width reads
                as a chart of something; at the width of the paragraph above it,
                it reads as a question about that paragraph — which is what it
                is. Same for the comment form, which is a place to write prose.
              */}
              <div className="hero-item mt-14 max-w-measure [animation-delay:500ms] 2xl:max-w-measure-wide">
                <Rating postId={post.id} />
              </div>

              <div className="mt-14 max-w-measure 2xl:max-w-measure-wide">
                <CommentThread postId={post.id} comments={comments} />
              </div>

              {/*
                Full width, unlike the two above: three cards across the column
                is the shape this already had at `sm`, and it is the last thing
                on the page, so widening rather than narrowing is the right way
                to end.
              */}
              <div className="mt-14">
                <RelatedPosts post={post} posts={allPosts} />
              </div>
            </div>
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
        // Full width up to the full container's 120rem cap.
        sizes="(min-width: 1920px) 114rem, 100vw"
        priority
        className="object-cover"
      />
    </div>
  );
}
