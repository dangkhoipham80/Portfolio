import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { ConsoleNav } from "@/components/console/console-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { requireAdmin } from "@/lib/admin-guard";
import { accessTokenExpiry } from "@/lib/session";

/**
 * The admin shell: one status strip, then the page.
 *
 * A left sidebar is the reflex for an admin area and would be the wrong
 * furniture here — it is the one shape that says "generic dashboard", and this
 * site's established vocabulary is horizontal mono status strips, the same as
 * the hero's health line and the career timeline's meta rows.
 *
 * This layout is also the gate. `requireAdmin` runs before any page under
 * /admin renders and redirects a signed-out or expired caller, so pages below
 * can assume a session. It is not what protects the data — every read carries
 * the token to the API and `require_admin` there decides — it is what turns an
 * expired session into a sign-in screen rather than a page of error states.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user, accessToken } = await requireAdmin("/admin");
  const expiresAt = accessTokenExpiry(accessToken);

  return (
    <>
      <header className="border-b border-border bg-card/60">
        <Container
          width="layout"
          className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 font-mono text-xs"
        >
          <Link
            href="/admin"
            // min-h-11: as bare inline text this was a 66×16 target, which is
            // under the 44px floor every other control on the site meets. It
            // became worth fixing once there was a nav under it to go back from.
            className="inline-flex min-h-11 items-center uppercase tracking-[0.18em] text-foreground hover:text-primary"
          >
            Console
          </Link>

          <span className="text-muted-foreground">{user.email}</span>

          <Badge variant="outline">admin</Badge>

          {expiresAt && (
            /*
              A fixed timestamp, not a ticking countdown. A counter would need a
              client component and an interval for something this sentence says
              just as well — and the number it would count towards is only
              approximate anyway, since any page load may renew the session.
            */
            <span className="text-muted-foreground">
              session until{" "}
              <time dateTime={expiresAt.toISOString()}>
                {expiresAt.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </span>
          )}

          {/*
            A real form posting a Server Action, so signing out works without
            JavaScript and is a POST rather than a link — a GET that destroys a
            session gets fired by every prefetcher and link scanner that meets
            it.
          */}
          <form action={signOut} className="ms-auto">
            {/* min-h-11 keeps the 44px tap target the base Button gets from
                py-3; the compact padding here would otherwise leave it at 33px. */}
            <Button variant="quiet" type="submit" className="min-h-11 px-4 py-2 text-xs">
              Sign out
            </Button>
          </form>
        </Container>
      </header>

      {/*
        The way between sections, under the status strip rather than beside it:
        one row says who you are, the next says where you can go, and neither
        has to compete with the other for width.
      */}
      <ConsoleNav />

      {children}
    </>
  );
}
