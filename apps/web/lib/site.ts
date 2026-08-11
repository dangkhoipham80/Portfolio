/**
 * The site's own absolute URL.
 *
 * Needed by the three things that cannot use a relative path: the sitemap, the
 * RSS feed, and Open Graph tags. Everything else on the site links relatively
 * and should keep doing so.
 *
 * Not prefixed `NEXT_PUBLIC_`, because only server-rendered output uses it —
 * same reasoning as `API_URL`. The default is the production URL rather than
 * localhost: a missing variable in a preview deploy should produce links that
 * work, not links to a machine the reader does not have.
 */
export const SITE_URL = (process.env.SITE_URL ?? "https://khoipham.vercel.app").replace(
  /\/$/,
  "",
);

/** An absolute URL for `path`, which must start with a slash. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
