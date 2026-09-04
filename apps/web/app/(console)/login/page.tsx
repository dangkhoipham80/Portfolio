import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { Container } from "@/components/ui/container";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { ScreenTitle } from "@/components/ui/screen-title";
import { hasLiveSession } from "@/lib/admin-guard";
import { cn } from "@/lib/cn";
import { ADMIN_PATH, safeNextPath } from "@/lib/session";

export const metadata: Metadata = {
  title: "Console access",
};

/**
 * The way in to the admin area.
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
  // Already signed in? Go straight through.
  //
  // This is what lets the header's console control be a plain static link. The
  // alternative — having the header ask who is signed in — means calling
  // cookies() in a component every page renders, which opts the entire public
  // site out of static rendering to answer a question only the owner ever asks.
  //
  // The check is the real one rather than "is there a cookie", so a stale
  // cookie shows the form instead of bouncing to /admin and being sent back.
  if (await hasLiveSession()) redirect(ADMIN_PATH);

  const params = await searchParams;
  const raw = params.next;
  // Never rendered into an href — it is a hidden form value the action
  // re-validates — but sanitised here too so nothing downstream inherits an
  // attacker-chosen string.
  const next = safeNextPath(typeof raw === "string" ? raw : null);

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
          <ScreenTitle>Console access</ScreenTitle>
          <p className="mt-4 text-muted-foreground">
            This area manages the site&rsquo;s content. There is no public
            sign-up — the one account is created from the command line.
          </p>

          <div className="mt-10">
            <LoginForm next={next} />
          </div>

          <p className={cn(eyebrowClasses, "mt-10")}>
            <Link href="/" className="underline underline-offset-4 hover:text-primary">
              Back to the site
            </Link>
          </p>
        </div>
      </Container>
    </main>
  );
}
