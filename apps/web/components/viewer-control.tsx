"use client";

// A client component because the answer depends on a cookie, and every page on
// this site is prerendered — reading that cookie during render would take the
// whole public site dynamic to answer a question that is "nobody" for most
// visitors. See lib/viewer-store.ts and app/api/session/route.ts.

import Link from "next/link";

import { cn } from "@/lib/cn";
import { useViewer } from "@/lib/viewer-store";

/**
 * Who is reading, in the header.
 *
 * ## What it replaces, and what it does not
 *
 * The console key. That control has always pointed at /login as a plain static
 * link, and for a signed-out visitor it still does — nothing about the header
 * changes for the people most of the traffic is.
 *
 * Once somebody is signed in the same slot becomes their monogram, linking to
 * their reading. An admin gets the key *as well*, still pointing at /admin: that
 * pair is the switch between the two interfaces, and it is a switch rather than
 * a sign-out because both are the same session. The admin can read the site as a
 * reader, comment as themselves and keep reading progress, with the console one
 * control away in the same corner it has always been in.
 *
 * ## Why the monogram and not a name
 *
 * The header is a row of 44px instrument switches next to a wordmark; a name in
 * it would be a fifth destination-shaped thing. The monogram takes the same box
 * as the theme toggle and the key, so it reads as another switch — and `title`
 * plus the screen-reader label carry the name for anyone who needs it spelled
 * out.
 *
 * ## Why the streak is here at all
 *
 * Because a streak nobody sees is a number in a database. It rides on the
 * monogram as a ring of segments, one per day of the current run — the site's
 * own spine-and-node vocabulary rather than a badge with a numeral on it, which
 * is the shape every gamified counter has. The accessible name says it in words.
 */

/** Past this, the ring is full and the number stops being a shape. */
const RING_CAP = 7;

export function ViewerControl() {
  const { status, viewer } = useViewer();

  // While the answer is unknown, render the signed-out control. It is the
  // correct answer for most visitors and it is a link to a page that will send
  // a signed-in one straight back out again, so the worst case of being wrong
  // for a few hundred milliseconds is a link that momentarily says "sign in".
  if (status !== "ready" || !viewer) return <SignInKey />;

  return (
    <>
      <Link
        href="/reading"
        title={`${viewer.name} — your reading`}
        className={cn(
          // The same explicit 44x44 box as ThemeToggle and the key: padding
          // around a small glyph lands well under the tap target on a phone.
          "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          "border border-border text-muted-foreground transition-colors",
          "hover:border-primary/40 hover:text-primary",
        )}
      >
        {viewer.streak > 0 ? <StreakRing days={viewer.streak} /> : null}
        <span aria-hidden="true" className="font-mono text-xs tracking-tight">
          {initials(viewer.name)}
        </span>
        <span className="sr-only">
          Your reading
          {viewer.streak > 0
            ? ` — signed in ${viewer.streak} ${viewer.streak === 1 ? "day" : "days"} running`
            : ""}
        </span>
      </Link>

      {viewer.isAdmin ? <ConsoleKey /> : null}
    </>
  );
}

/**
 * The streak, as a ring of segments around the monogram.
 *
 * Drawn as a dashed circle rather than as N elements: one stroke, one `--signal`,
 * and the arithmetic is `stroke-dasharray` against the circumference. A day is a
 * segment with a gap after it, so a run of three reads as three marks and a full
 * week as a closed ring.
 *
 * `aria-hidden` because the link's own label says it in words — this is the
 * second carrier, never the only one.
 */
function StreakRing({ days }: { days: number }) {
  const segments = Math.min(days, RING_CAP);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const gap = 3;
  const segment = circumference / segments - gap;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 44 44"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="hsl(var(--signal))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={`${segment} ${gap}`}
        // Start at the top rather than at three o'clock, so a single segment
        // sits where a reader looks first.
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
}

/** Up to two letters, from whatever the account is called. */
function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => [...part][0]?.toUpperCase() ?? "")
    .join("");

  return letters || "?";
}

const KEY_BOX = cn(
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border",
  "text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
);

/** The signed-out control: the key, exactly as it was, pointing at sign-in. */
function SignInKey() {
  return (
    <Link href="/login" title="Sign in" className={KEY_BOX}>
      <KeyGlyph />
      <span className="sr-only">Sign in</span>
    </Link>
  );
}

/** The signed-in admin's other half of the switch. */
function ConsoleKey() {
  return (
    <Link href="/admin" title="Console" className={KEY_BOX}>
      <KeyGlyph />
      <span className="sr-only">Console</span>
    </Link>
  );
}

/*
 * An SVG rather than a text glyph. ThemeToggle can use ☾/☀ because both are in
 * every system font; the key and padlock characters are not, and a missing one
 * renders as a tofu box in the header.
 */
function KeyGlyph() {
  return (
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
  );
}
