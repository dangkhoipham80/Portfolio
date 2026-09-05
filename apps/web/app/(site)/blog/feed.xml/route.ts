import { getPosts } from "@/lib/api";
import { DEFAULT_LANGUAGE, langAttribute } from "@/lib/languages";
import { summarise } from "@/lib/markdown";
import { absoluteUrl, SITE_AUTHOR } from "@/lib/site";

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
        // `xml:lang` per item, because the feed is mixed. RSS 2.0 has no
        // per-item language element — `<language>` is channel-level and says
        // one thing about all of them — but `xml:lang` is a plain XML
        // attribute and is valid anywhere, which is how a reader is told that
        // this entry is not in the language the channel claims.
        `    <item xml:lang="${langAttribute(post.language)}">`,
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        // A guid that is not a URL still has to be stable; the permalink is
        // both, and `isPermaLink` says so explicitly rather than by default.
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <description>${escapeXml(post.excerpt ?? summarise(post.body))}</description>`,
        published ? `      <pubDate>${published}</pubDate>` : null,
        // `dc:creator` rather than RSS's own `<author>`, which is specified as
        // an email address — publishing one in a feed is a spam trap, and a
        // name is what a reader actually displays.
        `      <dc:creator>${escapeXml(post.author_name ?? SITE_AUTHOR)}</dc:creator>`,
        // The display name, not the slug: a category is read by a person in a
        // feed reader, so "Next.js" rather than "next-js".
        ...post.tags.map((tag) => `      <category>${escapeXml(tag.name)}</category>`),
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
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    "    <title>Phạm Đăng Khôi — Writing</title>",
    `    <link>${absoluteUrl("/blog")}</link>`,
    "    <description>Notes on what I built, what broke, and what the fix turned out to be.</description>",
    // The channel's language, which was hardcoded to "en" while nearly every
    // post in it was Vietnamese. RSS allows one value here for the whole feed,
    // so the honest answer is the language most of it is written in; the
    // entries that differ say so on themselves with `xml:lang` above.
    `    <language>${DEFAULT_LANGUAGE}</language>`,
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
