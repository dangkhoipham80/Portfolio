import Link from "next/link";

/**
 * The way in to the admin console, from the public site.
 *
 * Sized and shaped like ThemeToggle on purpose: they are the two controls in
 * the header that act on the site rather than navigate it, so they read as a
 * pair of instrument switches sitting apart from the content links.
 *
 * It always points at /login. Reading the session here would mean calling
 * `cookies()` in the header, which every page renders — and that opts the whole
 * public site out of static rendering to answer a question only the owner ever
 * asks. `/login` is already dynamic, so it does the redirect to /admin itself
 * when a session is live.
 *
 * "Console" rather than "Login" because that is what the destination calls
 * itself: the page is headed "Console access" and the admin strip says CONSOLE.
 * One name for one thing, the whole way through.
 */
export function ConsoleLink() {
  return (
    <Link
      href="/login"
      // The sr-only text below names it for assistive tech; `title` is what
      // gives a sighted visitor the same answer, since a key icon on a
      // portfolio is not self-evident.
      title="Console"
      // Same explicit 44x44 box as ThemeToggle — padding around a 16px icon
      // lands well under the tap target on a phone.
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
    >
      {/*
        An SVG rather than a text glyph. ThemeToggle can use ☾/☀ because both
        are in every system font; the key and padlock characters are not, and a
        missing glyph renders as a tofu box in the header.
      */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <circle cx="8" cy="12" r="3.25" />
        <path d="M11.25 12H20" />
        <path d="M17 12v3" />
        <path d="M20 12v2" />
      </svg>
      <span className="sr-only">Console</span>
    </Link>
  );
}
