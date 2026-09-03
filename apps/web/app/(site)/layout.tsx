import Link from "next/link";
import { Fragment } from "react";

import { SkipLink } from "@/components/skip-link";
import { SiteNav } from "@/components/site-nav";
import { Container } from "@/components/ui/container";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { ExternalLink } from "@/components/ui/external-link";
import { CHANNELS, isMailto } from "@/lib/channels";
import { cn } from "@/lib/cn";

/**
 * Chrome for the public portfolio: nav, content, footer.
 *
 * Split out of the root layout so the console can render without it. The group
 * folder is parenthesised, so `/`, `/career-journey`, `/certificates` and
 * `/projects/[slug]` keep the URLs they had.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {/*
        The page's light source. Here rather than in the root layout because
        the console deliberately does not share the site's surface, and a
        fixed decorative layer in the root would bleed into it.
      */}
      <div aria-hidden="true" className="page-light" />
      <SkipLink />
      <SiteNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      {/*
        Same reasoning as the header: this was a hairline and two lines of mono
        text sitting directly on the graph paper, so it read as leftover content
        at the bottom of the page rather than as the end of it. `bg-card` gives
        it the surface the header now has, and the pair frames the paper between
        them.

        `mt-auto` matters on short pages — the 404 and an empty section would
        otherwise leave the footer floating mid-screen with paper below it.
      */}
      <footer className="mt-auto border-t border-border/60 bg-card">
        <Container width="full" className="pt-10">
          {/*
            The end of the line. Every page's spine has to terminate somewhere,
            and a file that ends cleanly ends at EOF — the one quiet joke the
            site allows itself, in the same node-plus-mono-label vocabulary as
            every junction above it.
          */}
          <p aria-hidden="true" className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span className="spine-node shrink-0" />
            /eof
          </p>
        </Container>
        <Container
          width="full"
          className="flex flex-col gap-8 py-8 sm:flex-row sm:items-start sm:justify-between"
        >
          {/*
            The contact channels, on every page rather than only at the bottom
            of the home page. Someone reading /certificates or a project detail
            had no way to make contact without navigating back to / and
            scrolling to the end of it — which is a lot to ask of a recruiter
            who has already decided to get in touch.
          */}
          {/*
            A two-column grid rather than a fixed-width label column. `w-16`
            fitted EMAIL and GITHUB and was 11px too narrow for LINKEDIN, which
            ran into its own value with no gap. `auto` sizes the column to the
            longest label, so adding a channel cannot break the alignment.
          */}
          <nav
            aria-label="Elsewhere"
            className="grid grid-cols-[auto_1fr] items-center gap-x-5"
          >
            {CHANNELS.map((channel) => (
              <Fragment key={channel.label}>
                <span className={eyebrowClasses}>{channel.label}</span>

                {isMailto(channel.href) ? (
                  // Not an ExternalLink: a mailto does not leave for another
                  // site, so the ↗ would be a lie and the new tab it opens
                  // would be left behind empty.
                  <a
                    href={channel.href}
                    className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {channel.value}
                  </a>
                ) : (
                  <ExternalLink href={channel.href}>{channel.value}</ExternalLink>
                )}
              </Fragment>
            ))}
          </nav>

          <div
            className={cn(
              eyebrowClasses,
              "flex flex-col gap-1 sm:items-end sm:text-right",
            )}
          >
            <span>© {new Date().getFullYear()} Phạm Đăng Khôi</span>
            <span>Ho Chi Minh City, Vietnam</span>

            {/*
              The way into the console on a phone, where the header has no room
              for the key control. Underlined rather than tinted: at this size,
              in mono uppercase at 0.18em tracking, colour alone is not enough
              of a signal that it is a link.

              min-h-11 because as bare inline text it was a 16px tap target.
            */}
            {/* Demoted from the primary nav: supporting evidence lives at the
                end of the page, still one click from anywhere. */}
            <Link
              href="/certificates"
              className="mt-1 inline-flex min-h-11 items-center underline underline-offset-4 transition-colors hover:text-primary sm:justify-end"
            >
              Certificates
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center underline underline-offset-4 transition-colors hover:text-primary sm:justify-end"
            >
              Console
            </Link>
          </div>
        </Container>
      </footer>
    </>
  );
}
