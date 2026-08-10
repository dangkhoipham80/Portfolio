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
      <footer className="border-t border-border py-8">
        <Container
          width="layout"
          className="flex flex-col gap-1 text-center font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground sm:flex-row sm:justify-between sm:text-left"
        >
          <span>© {new Date().getFullYear()} Phạm Đăng Khôi</span>
          <span>Ho Chi Minh City, Vietnam</span>
        </Container>
      </footer>
    </>
  );
}
