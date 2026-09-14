"use client";

// A client component for one reason: whether the reader is signed in is a fact
// about a cookie, and every page on this site is prerendered. See
// lib/viewer-store.ts. The body itself arrives as a child rendered on the
// server — this renders it untouched until there is something else to render.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { unlockPost } from "@/app/actions/engagement";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { publishArticle, resetArticle } from "@/lib/article-state";
import { cn } from "@/lib/cn";
import { useViewer } from "@/lib/viewer-store";

/**
 * The post's body, and — on a long one — the gate at the end of what is public.
 *
 * ## What the gate is not
 *
 * A gradient over the rest of the article. That is the usual shape and it is a
 * lie: the text is in the response, and "read the rest" is View Source. Here the
 * rest is genuinely not on the page — the API cuts a long post before sending it
 * to anyone who is not signed in, so the gate is the end of the document rather
 * than a lid on it. Nothing is faded, because there is nothing behind it.
 *
 * ## Why it can unlock without a page load
 *
 * Because the page cannot. It is prerendered, for everybody, which is what keeps
 * the public part of a post fast and indexable — so a reader who signs in and
 * comes back arrives at the same cut HTML. The rest is fetched once, by the
 * reader it belongs to, through the `unlockPost` action, and swapped in where
 * they left off. Nobody who has just signed in should have to find their
 * paragraph again.
 *
 * What comes back is React rather than markup, which is what lets an MDX post
 * keep its real components on the way through — see the action for why a route
 * handler returning a string was the wrong shape.
 *
 * ## What the eyebrow says
 *
 * How much is left, in minutes. The eyebrows on this site carry a path or a
 * count — a tracked-caps label that only restates its heading is the thing the
 * detector's `kicker-above-heading` rule is named for — and "9 min left" is the
 * one fact a reader needs to decide whether an account is worth it.
 */
export function ArticleBody({
  slug,
  gated,
  minutesLeft,
  children,
}: {
  slug: string;
  /** Whether the API withheld the rest of this post from an anonymous caller. */
  gated: boolean;
  /** Roughly how much is behind the gate. Zero when nothing is. */
  minutesLeft: number;
  /** The body, rendered on the server. Already carries `article-prose`. */
  children: ReactNode;
}) {
  const { status, viewer } = useViewer();
  const [unlocked, setUnlocked] = useState<ReactNode | null>(null);
  const [failed, setFailed] = useState(false);
  const pathname = usePathname();

  // The store is a module and outlives a client-side navigation between posts,
  // so the next post would otherwise inherit this one's contents list.
  useEffect(() => resetArticle, [pathname]);

  useEffect(() => {
    if (!gated || status !== "ready" || !viewer) return;

    let live = true;

    unlockPost(slug)
      .then((body) => {
        if (!live) return;
        if (!body) {
          setFailed(true);
          return;
        }

        setUnlocked(body.content);
        // The rail's contents list and the copy-button listener are both
        // outside this component and both now hold stale handles.
        publishArticle(body.headings);
      })
      .catch(() => {
        // The reader still has the part they could already read, and the panel
        // below says what happened rather than leaving the article to stop
        // mid-sentence with no explanation.
        if (live) setFailed(true);
      });

    return () => {
      live = false;
    };
  }, [gated, slug, status, viewer]);

  /*
    Rendered directly, not wrapped. `renderPostBody` already put `article-prose`
    on the element holding the markup, and every rule in that stylesheet is a
    direct-child selector — one element between the class and the content costs
    the whole article its spacing, which is the mistake lib/mdx.tsx records
    having made and which type-check, lint and build all passed.
  */
  if (unlocked !== null) return <>{unlocked}</>;

  return (
    <>
      {children}

      {gated ? (
        <Gate
          slug={slug}
          minutesLeft={minutesLeft}
          // Until the session answers, the gate renders its signed-out face.
          // That is the right guess for most readers, and the wrong one costs a
          // few hundred milliseconds of a panel that is about to be replaced.
          state={
            failed ? "failed" : status !== "ready" || !viewer ? "locked" : "unlocking"
          }
        />
      ) : null}
    </>
  );
}

function Gate({
  slug,
  minutesLeft,
  state,
}: {
  slug: string;
  minutesLeft: number;
  state: "locked" | "unlocking" | "failed";
}) {
  const back = `/blog/${slug}`;
  const nextParam = `?next=${encodeURIComponent(back)}`;

  return (
    <section
      aria-labelledby="gate-heading"
      className={cn(
        "mt-12 max-w-measure rounded-[var(--radius-card)] border border-border",
        "bg-card p-6 sm:p-8 2xl:max-w-measure-wide",
      )}
    >
      {/* A count, which is what an eyebrow on this site carries. */}
      <Eyebrow className="mb-3">
        {minutesLeft > 0 ? `${minutesLeft} min left` : "More below"}
      </Eyebrow>

      <h2
        id="gate-heading"
        className="font-display text-xl font-semibold tracking-tight text-foreground"
      >
        {state === "unlocking" ? "Fetching the rest…" : "The rest is behind a sign-in"}
      </h2>

      {state === "failed" ? (
        <Notice tone="error" className="mt-5">
          You are signed in, but the rest of the post did not arrive. Reload the
          page to try again.
        </Notice>
      ) : state === "unlocking" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          One moment — you are signed in, so this is on its way.
        </p>
      ) : (
        <>
          <p className="mt-3 max-w-[var(--measure)] text-muted-foreground">
            An account is free and is only used for reading. It also gets you a
            comment under your own name and a reading position that follows you
            between devices.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={`/login${nextParam}`} className={buttonClasses("primary")}>
              Sign in
            </Link>
            <Link href={`/join${nextParam}`} className={buttonClasses("quiet")}>
              Create an account
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
