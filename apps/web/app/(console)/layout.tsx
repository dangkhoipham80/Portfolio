import type { Metadata } from "next";

import { SkipLink } from "@/components/skip-link";

/**
 * Chrome for everything behind the sign-in: the login screen and the admin
 * area.
 *
 * Deliberately thin. The public nav is the wrong furniture here — its links go
 * back out to the marketing site, and a header offering Projects/Career/
 * Certificates above a password field reads as a different product. What
 * replaces it is per-area: `/admin` adds its own status strip, `/login` has no
 * chrome at all.
 */
export const metadata: Metadata = {
  // Nothing under here should ever be a search result. A portfolio whose login
  // screen is indexed alongside the work is a bad look, and the admin pages are
  // behind a session anyway — a crawler would only ever index the redirect.
  robots: { index: false, follow: false },
};

export default function ConsoleLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SkipLink />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
