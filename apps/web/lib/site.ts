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

/**
 * Who wrote the site, and by default everything on it.
 *
 * A post carries `author_name` only when it is *not* this — a guest post, or a
 * translation credited to whoever did it. Storing the owner's name on every row
 * instead would mean a rename leaves half the blog signed with the old
 * spelling, which is the failure a default exists to prevent.
 */
export const SITE_AUTHOR = "Phạm Đăng Khôi";

/** An absolute URL for `path`, which must start with a slash. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
