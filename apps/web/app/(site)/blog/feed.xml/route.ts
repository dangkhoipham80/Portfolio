import { getPosts } from "@/lib/api";
import { summarise } from "@/lib/markdown";
import { absoluteUrl } from "@/lib/site";

/**
 * RSS for the blog.
 *
 * Descriptions only, not full post bodies. A feed carrying the whole article
 * has to embed sanitised HTML inside XML, and that nesting is where feeds break
 * — one unescaped ampersand and the document stops parsing for every reader at
 * once. The excerpt is what a reader needs to decide to click.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * `&` first is not an accident of ordering — it is why this is a single pass.
 * Replacing `<` before `&` would leave `&lt;` and then escape its own
 * ampersand on the next pass, producing `&amp;lt;`.
 */
function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

/** RFC 822, which is what RSS specifies. UTC, so no reader sees a shifted date. */
function rfc822(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

export async function GET() {
  const posts = await getPosts();

  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/blog/${post.slug}`);
      const published = rfc822(post.published_at);

      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        // A guid that is not a URL still has to be stable; the permalink is
        // both, and `isPermaLink` says so explicitly rather than by default.
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <description>${escapeXml(post.excerpt ?? summarise(post.body))}</description>`,
        published ? `      <pubDate>${published}</pubDate>` : null,
        ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  // The newest post's date, not the time this ran. A build timestamp would
  // change the body of every response and defeat conditional requests, for a
  // field no reader looks at.
  const lastBuild = rfc822(posts[0]?.published_at ?? null);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Phạm Đăng Khôi — Writing</title>",
    `    <link>${absoluteUrl("/blog")}</link>`,
    "    <description>Notes on what I built, what broke, and what the fix turned out to be.</description>",
    "    <language>en</language>",
    `    <atom:link href="${absoluteUrl("/blog/feed.xml")}" rel="self" type="application/rss+xml" />`,
    lastBuild ? `    <lastBuildDate>${lastBuild}</lastBuildDate>` : null,
    items,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(xml, {
    headers: {
      // `charset` spelled out: the titles carry Vietnamese diacritics, and a
      // reader that guesses latin-1 renders the author's own name as mojibake.
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}

/** Matches the content cache in lib/api.ts; a feed does not need to be fresher. */
export const revalidate = 300;
