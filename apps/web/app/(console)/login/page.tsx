import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { Container } from "@/components/ui/container";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { ScreenTitle } from "@/components/ui/screen-title";
import { cn } from "@/lib/cn";
import { landingPath, safeNextPath } from "@/lib/session";
import { readViewer } from "@/lib/viewer-server";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * The way in, for the owner and for a reader alike.
 *
 * ## Why there is one of these and not two
 *
 * It was the console's door and is now everyone's, which looks like it should
 * mean a second, friendlier screen somewhere on the site. It does not. A second
 * screen is a second form, a second set of field rules and a second place for
 * the `next` round trip to be got subtly wrong — and the thing a reader and the
 * owner are doing here is identical: exchanging an address and a password for
 * the same cookie pair, through the same action.
 *
 * What differs is only where they end up, and that is decided after the fact by
 * who the account turns out to be. See `landing` in app/actions/auth.ts.
 *
 * Composed as a panel sitting on the site's own grid rather than a card
 * floating in the middle of an empty screen. The centred-card login is the
 * default answer everywhere, and here it would read as a different product
 * bolted on — the graph paper, the atmosphere glow and the mono status line all
 * carry over from the public pages, so the console looks like the same machine
 * seen from the back.
 *
 * The animated wire under the fields is the tie: it is the device the contact
 * form uses to show a visitor's message going out to the API, and this is the
 * same wire carrying credentials to the same backend.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const raw = params.next;
  // Never rendered into an href unescaped — it is a hidden form value the action
  // re-validates — but sanitised here too so nothing downstream inherits an
  // attacker-chosen string. The fallback is empty so that "they did not ask for
  // anywhere" survives, and is answered by the action from who they are.
  const next = safeNextPath(typeof raw === "string" ? raw : null, "");

  // Already signed in? Go straight through, to wherever they were heading.
  //
  // The check is the real one rather than "is there a cookie", so a stale cookie
  // shows the form instead of bouncing and being sent back.
  //
  // `landingPath` and not `next`, and the difference is not cosmetic: a reader
  // who opens /admin is sent here with `next=/admin`, and honouring that would
  // bounce them to the guard, which would send them back here, for as long as
  // the browser was willing to follow it. Shared with the sign-in action so the
  // two cannot disagree about this again.
  const viewer = await readViewer();
  if (viewer) redirect(landingPath(next, viewer.isAdmin));

  return (
    // The console group no longer supplies a <main>; each screen places its
    // own, so the skip link lands on content rather than on chrome.
    <main id="main" className="flex flex-1 items-center py-16 sm:py-24">
      <Container width="layout">
        {/*
          Left-aligned on the same rail the hero uses, and capped at a readable
          measure rather than stretched. On a wide screen the panel sits against
          the grid with the glow behind it, which is the composition the home
          page opens with.
        */}
        <div className="max-w-md">
          {/* No eyebrow here. "Restricted" said nothing "Console access"
              does not already say, and a tracked-caps label that only
              restates its heading is the shape the detector's
              kicker-above-heading rule is named for. The eyebrows that stay
              on this site carry a path and a count. */}
          <ScreenTitle>Sign in</ScreenTitle>
          <p className="mt-4 text-muted-foreground">
            An account gets you the rest of a long post, a comment under your own
            name, and a reading position that follows you between devices. The
            owner signs in here too, and lands in the console.
          </p>

          <div className="mt-10">
            <LoginForm next={next} />
          </div>

          <p className={cn(eyebrowClasses, "mt-10 flex flex-wrap gap-x-5 gap-y-1")}>
            <Link
              href={next ? `/join?next=${encodeURIComponent(next)}` : "/join"}
              className="underline underline-offset-4 hover:text-primary"
            >
              Create an account
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
