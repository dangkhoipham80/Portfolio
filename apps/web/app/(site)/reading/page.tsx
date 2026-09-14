import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Container } from "@/components/ui/container";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { readReadingList } from "@/lib/engagement";
import { formatFullDate, isoDay } from "@/lib/format";
import { LOGIN_PATH } from "@/lib/session";
import type { ReadingProgress } from "@/lib/types";
import { readViewer } from "@/lib/viewer-server";

export const metadata: Metadata = {
  title: "Your reading",
  // One person's reading list. There is nothing here for a crawler, and the
  // page would be empty to one anyway — it needs a session to say anything.
  robots: { index: false, follow: false },
};

/**
 * What this account has open, what it has finished, and how long its run is.
 *
 * ## Why this page is dynamic when the rest of the site is not
 *
 * Because it is one person's, and there is no version of it that could be
 * prerendered. Every other page here is the same for everybody and is built
 * once; this one reads the session during render and is rendered per request,
 * which is correct for it and would be wrong anywhere else — see
 * app/api/session/route.ts for what the public pages do instead.
 *
 * ## Why the streak is a row of nodes
 *
 * Because a streak is a run of days and a row of marks is what a run looks
 * like. The number is there in words beside it; the marks are the second
 * carrier, in the site's own spine-and-node vocabulary rather than a flame icon
 * and a counter, which is the shape every streak in every app has.
 *
 * ## Why finished posts stay in the list
 *
 * "Which of these have I read" is half of what this page answers, and a list
 * that drops a post the moment it is finished cannot answer it. They are marked
 * rather than removed.
 */
export default async function ReadingPage() {
  const viewer = await readViewer();
  if (!viewer) redirect(`${LOGIN_PATH}?next=${encodeURIComponent("/reading")}`);

  const entries = await readReadingList();
  const finished = entries.filter((entry) => entry.finished).length;

  return (
    <main id="main">
      <article className="py-12 sm:py-16">
        <Container width="layout">
          <header className="max-w-3xl">
            <Eyebrow className="hero-item">{viewer.name}</Eyebrow>
            <h1 className="hero-item mt-3 font-display text-3xl font-bold tracking-tight text-foreground [animation-delay:80ms] sm:text-4xl">
              Your reading
            </h1>

            <div className="hero-item mt-8 [animation-delay:160ms]">
              <Streak days={viewer.streak} />
            </div>
          </header>

          <section
            aria-labelledby="reading-list"
            className="hero-item mt-14 [animation-delay:240ms]"
          >
            <div className="flex items-center gap-4">
              <Eyebrow as="h2" id="reading-list" className="text-foreground">
                {entries.length === 0
                  ? "Nothing yet"
                  : `${finished} of ${entries.length} finished`}
              </Eyebrow>
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
            </div>

            {entries.length === 0 ? (
              // An empty screen is an invitation to act, not a status report.
              <div className="mt-6 max-w-[var(--measure)]">
                <p className="text-muted-foreground">
                  Open a post and this fills in. Where you got to is kept against
                  your account, so it is the same on your phone as it is here.
                </p>
                <Link href="/blog" className={cn(buttonClasses("primary"), "mt-6")}>
                  Read something
                </Link>
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-border border-b border-border">
                {entries.map((entry) => (
                  <li key={entry.post_id}>
                    <Entry entry={entry} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Container>
      </article>
    </main>
  );
}

/**
 * The run of days, as marks.
 *
 * Capped at a fortnight of nodes: past that the row stops being countable at a
 * glance and becomes a texture, and the figure beside it is the thing carrying
 * the number anyway.
 */
const STREAK_CAP = 14;

function Streak({ days }: { days: number }) {
  const marks = Math.min(days, STREAK_CAP);

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <p className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {days === 0
            ? "No streak yet"
            : `${days} ${days === 1 ? "day" : "days"} running`}
        </p>

        {marks > 0 ? (
          <span aria-hidden="true" className="flex items-center gap-1.5">
            {Array.from({ length: marks }, (_, index) => (
              <span key={index} className="spine-node" />
            ))}
            {days > STREAK_CAP ? (
              <span className={eyebrowClasses}>+{days - STREAK_CAP}</span>
            ) : null}
          </span>
        ) : null}
      </div>

      {/*
        Its own block, not a `w-full` third item in the row above. A flex item
        shrinks by default, so `w-full` there did not force a line break — it
        just shrank to whatever was left, and the sentence sat on the same line
        as the figure it explains.
      */}
      <p className="mt-2 max-w-[var(--measure)] text-sm text-muted-foreground">
        {days === 0
          ? "Sign in on two days in a row and this starts counting."
          : "Counted per day, in UTC. Miss a day and it starts again."}
      </p>
    </div>
  );
}

/**
 * One post, with where the reader got to.
 *
 * A ledger row on a hairline, like the blog index — the same vocabulary for the
 * same kind of thing, so this reads as a record rather than as a second list of
 * headlines.
 */
function Entry({ entry }: { entry: ReadingProgress }) {
  const day = isoDay(entry.last_read_at);
  const percent = Math.round(entry.progress * 100);

  const inner = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="font-display font-semibold tracking-tight text-foreground">
          {entry.post_title ?? "A post that has since gone"}
        </span>

        <span className={cn(eyebrowClasses, "flex items-center gap-2")}>
          {entry.finished ? (
            <>
              {/* A node rather than a tick: the site marks state with a dot, and
                  --live is the one hue that means "this is true". */}
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-live" />
              Finished
            </>
          ) : (
            `${percent}% read`
          )}
        </span>
      </div>

      {day ? (
        <time dateTime={day} className={cn(eyebrowClasses, "mt-1 block tracking-normal")}>
          {formatFullDate(entry.last_read_at)}
        </time>
      ) : null}

      <span aria-hidden="true" className="mt-3 block h-px w-full bg-border">
        <span
          className={cn("block h-px", entry.finished ? "bg-live" : "bg-foreground/50")}
          style={{ width: `${entry.finished ? 100 : percent}%` }}
        />
      </span>
    </>
  );

  // A row whose post has been deleted keeps its progress and loses its link.
  // Rendering a dead href would be worse than saying so.
  if (!entry.post_slug) {
    return <div className="block py-5">{inner}</div>;
  }

  return (
    <Link
      href={`/blog/${entry.post_slug}`}
      className="block py-5 transition-colors hover:bg-card"
    >
      {inner}
    </Link>
  );
}
