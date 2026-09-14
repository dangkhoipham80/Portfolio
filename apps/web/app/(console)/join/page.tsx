import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinForm } from "@/components/join-form";
import { Container } from "@/components/ui/container";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { ScreenTitle } from "@/components/ui/screen-title";
import { cn } from "@/lib/cn";
import { safeNextPath, SITE_PATH } from "@/lib/session";
import { readViewer } from "@/lib/viewer-server";

export const metadata: Metadata = {
  title: "Create an account",
};

/**
 * Where a reader gets an account.
 *
 * ## Why it is in the console group and not on the site
 *
 * Because the sign-in screen is, and these two are read in the same minute. A
 * reader who meets the gate goes to one of them, finds it was the wrong one and
 * follows the link to the other — and a sign-up with the site's full nav and
 * footer leading to a sign-in with none of it reads as two different products,
 * which is the exact seam the console layout's comment is about. The group
 * gives both screens the same thin chrome and the same `robots: noindex`.
 *
 * ## What an account is for, said on the page
 *
 * Three things, listed, because "create an account" with no reason attached is
 * the request every site makes and most people refuse. The three are true and
 * they are the only three: the rest of a long post, a comment under your own
 * name, and a reading position that follows you to another device.
 */
export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  // Already signed in? There is nothing here for them. Straight back to
  // wherever they were going, which is the site unless they said otherwise.
  const params = await searchParams;
  const raw = params.next;
  const next = safeNextPath(typeof raw === "string" ? raw : null, SITE_PATH);

  if (await readViewer()) redirect(next);

  return (
    // The console group supplies no <main>; each screen places its own, so the
    // skip link lands on content rather than on chrome.
    <main id="main" className="flex flex-1 items-center py-16 sm:py-24">
      <Container width="layout">
        {/* Left-aligned on the same rail the hero uses, capped at a readable
            measure rather than stretched — the composition the home page opens
            with, which is what keeps the console looking like the same machine
            seen from the back. */}
        <div className="max-w-md">
          <ScreenTitle>Create an account</ScreenTitle>

          <p className="mt-4 text-muted-foreground">
            An account is only used for reading. It gets you:
          </p>

          {/*
            A list, and the markers are the site's own spine nodes rather than
            bullets or ticks — the same vocabulary as every junction on the home
            page. Three short clauses; a tick-list of benefits in sentence case
            with an icon each is the shape every sign-up page has.
          */}
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {[
              "the rest of a long post",
              "a comment signed with your own name",
              "a reading position that follows you between devices",
            ].map((line) => (
              <li key={line} className="flex items-baseline gap-3">
                <span aria-hidden="true" className="spine-node shrink-0" />
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <JoinForm next={next} />
          </div>

          <p className={cn(eyebrowClasses, "mt-10 flex flex-wrap gap-x-5 gap-y-1")}>
            <Link
              href={next === SITE_PATH ? "/login" : `/login?next=${encodeURIComponent(next)}`}
              className="underline underline-offset-4 hover:text-primary"
            >
              Already have one
            </Link>
            <Link href="/" className="underline underline-offset-4 hover:text-primary">
              Back to the site
            </Link>
          </p>
        </div>
      </Container>
    </main>
  );
}
