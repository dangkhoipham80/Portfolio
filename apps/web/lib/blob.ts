/**
 * Where uploaded images live, in one place.
 *
 * Imported by *both* `next.config.ts` and the components that render an image,
 * because the two have to agree: the config decides which hosts next/image will
 * fetch, and a component that hands next/image an unlisted host gets a 400 and
 * renders nothing. Declaring the hostname twice is how those drift apart.
 *
 * No imports of its own, and nothing Next-specific, so the config file can load
 * it without dragging the app's module graph into the build config.
 */

/**
 * This project's Vercel Blob store, from `vercel blob get-store` ("Base URL").
 *
 * Deliberately one exact host rather than `**.public.blob.vercel-storage.com`:
 * that wildcard turns `/_next/image` into an open proxy for every Blob store on
 * the platform.
 */
export const BLOB_HOSTNAME = "8nvvdsrnxea4lvva.public.blob.vercel-storage.com";

/**
 * Whether next/image is allowed to touch this URL.
 *
 * `image_url` is a free-text field — the admin can paste a link to anything,
 * and older rows may point at hosts that no longer exist. Passing one of those
 * to next/image is not a soft failure: it throws at render, which would take
 * out the whole page for one bad string, and this site's rule is that a page
 * renders even when the data behind it does not.
 *
 * So callers ask first and fall back to an unoptimised treatment when the
 * answer is no. Parsing rather than string-matching, because
 * `https://evil.example/?x=8nvvdsrnxea4lvva.public.blob.vercel-storage.com`
 * passes `includes()` and is not this host.
 */
export function isOptimisableImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === BLOB_HOSTNAME;
  } catch {
    // Not an absolute URL at all — a relative path, or something mistyped.
    return false;
  }
}
