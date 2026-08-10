import Link from "next/link";

import { SkipLink } from "@/components/skip-link";
import { SiteNav } from "@/components/site-nav";
import { Container } from "@/components/ui/container";

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
      <footer className="mt-auto border-t border-border bg-card">
        <Container
          width="layout"
          className="flex flex-col items-center gap-4 py-8 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground sm:flex-row sm:justify-between"
        >
          <span>© {new Date().getFullYear()} Phạm Đăng Khôi</span>

          <span className="flex items-center gap-3 sm:gap-4">
            <span>Ho Chi Minh City, Vietnam</span>

            {/*
              Same hairline the header uses between destinations and controls.
              Without it the two spans read as one run — "VIETNAM CONSOLE" — and
              the link disappears into the metadata beside it.
            */}
            <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />

            {/*
              The second way in, for anyone who reads footers rather than
              hunting for a key icon. Underlined rather than tinted: at this
              size, in mono uppercase at 60% tracking, colour alone is not
              enough of a signal that it is a link.
            */}
            <Link
              href="/login"
              // min-h-11: as bare inline text this was a 16px-tall tap target,
              // which is a miss on a phone. The row is centred, so the extra
              // height costs nothing visually.
              className="inline-flex min-h-11 items-center underline underline-offset-4 transition-colors hover:text-primary"
            >
              Console
            </Link>
          </span>
        </Container>
      </footer>
    </>
  );
}
