import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { ConsoleNav } from "@/components/console/console-nav";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-guard";
import { accessTokenExpiry } from "@/lib/session";

/**
 * The admin shell: a sidebar on the left, content on the right.
 *
 * This replaces two stacked horizontal strips — a status bar and a nav bar —
 * which is what was here before. That arrangement was argued for in a comment
 * that said a sidebar was "the reflex" and the wrong furniture. Built and
 * looked at, it was worse: two full-width bands of chrome above every screen,
 * content centred in a narrow column with the page's graph paper showing down
 * both sides, and no room for identity and navigation to be different things.
 * The reflex was right. A tool with six sections wants a column it can grow
 * into, and the width belongs to the content.
 *
 * The gate lives here too. `requireAdmin` runs before any page under /admin
 * renders. It is not what protects the data — every read carries the token to
 * the API, and `require_admin` there decides — it is what turns an expired
 * session into a sign-in screen rather than a page of error states.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user, accessToken } = await requireAdmin("/admin");
  const expiresAt = accessTokenExpiry(accessToken);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      {/*
        Sticky and full-height above `lg`, so the sections stay reachable
        however long a list runs. Below it the column becomes a band at the top
        of the page — a drawer would need a client component and a state hook
        for six links that fit on one scrollable line.
      */}
      <aside className="c-sidebar shrink-0 border-b border-border bg-card lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-0 lg:px-3 lg:py-5">
          <Link
            href="/admin"
            className="order-1 inline-flex min-h-11 items-center gap-2 px-1 font-display text-sm font-semibold tracking-tight text-foreground lg:mb-6"
          >
            {/* The mark: the accent as a shape rather than as more text. */}
            <span
              aria-hidden="true"
              className="h-2 w-2 rotate-45 rounded-[2px] bg-primary"
            />
            Console
          </Link>

          <div className="order-3 w-full lg:order-2 lg:w-auto lg:flex-1">
            <ConsoleNav />
          </div>

          {/*
            Identity at the foot of the column, where an app puts it. Hidden on
            the narrow layout: it is reference, not navigation, and it would
            cost three rows of a phone screen before any content.
          */}
          <div className="order-4 hidden w-full border-t border-border/70 pt-4 lg:block">
            <p className="truncate px-1 text-xs text-muted-foreground" title={user.email}>
              {user.email}
            </p>
            {expiresAt && (
              /*
                A fixed time, not a countdown. A ticking clock needs a client
                component and an interval to say what this sentence says, and
                the number is approximate anyway — any page load may renew it.
              */
              <p className="mt-1 px-1 font-mono text-[0.6875rem] text-muted-foreground/80">
                session until{" "}
                <time dateTime={expiresAt.toISOString()}>
                  {expiresAt.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </p>
            )}
          </div>

          {/*
            A real form posting a Server Action, so signing out works without
            JavaScript and is a POST rather than a link — a GET that destroys a
            session gets fired by every prefetcher that meets it.
          */}
          <form action={signOut} className="order-2 ms-auto lg:order-5 lg:ms-0 lg:mt-3 lg:w-full">
            <Button
              variant="quiet"
              type="submit"
              className="min-h-11 w-full px-4 py-2 text-xs"
            >
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
