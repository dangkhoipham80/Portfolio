/**
 * Seconds from a `Retry-After` header, or null when it is missing or odd.
 *
 * Shared by the contact form and the sign-in form. Both post to a rate-limited
 * API route and both have to tell the person when they may try again, and the
 * API's window is an hour on one and a quarter of an hour on the other — long
 * enough that "try again later" is not usable guidance.
 *
 * Lifted out of app/actions/contact.ts when sign-in became the second caller.
 */
export function retryAfterSeconds(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;

  // slowapi sends a delta in seconds by default. An HTTP-date is also legal, so
  // parse defensively rather than rendering "NaN minutes" at someone.
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds);

  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;

  return Math.max(0, Math.round((date - Date.now()) / 1000));
}

/**
 * A wait in words, for a sentence like "try again {formatWait(n)}".
 *
 * Moved here unchanged from components/contact-form.tsx so the sign-in form
 * says it the same way. Deliberately approximate — "in about 12 minutes" is
 * what a person needs, and a precise countdown would need a client timer for
 * no gain.
 */
export function formatWait(seconds: number | null): string {
  if (seconds === null) return "in a little while";
  if (seconds < 60) return "in under a minute";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}
