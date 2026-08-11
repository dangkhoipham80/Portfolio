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

/**
 * `console-theme` is applied here so both screens behind the door share it — a
 * light sign-in leading to a dark console is a seam in the one place a person
 * sees both in the same second.
 *
 * There is no `<main>` here any more. It used to wrap `children`, which was
 * fine while the console was a single column; the admin area now has a sidebar,
 * and a nav rendered inside `<main>` is both the wrong landmark and a broken
 * skip link — "skip to content" would land *before* the navigation and skip
 * nothing. Each area owns its own `<main>` and puts it where content starts.
 */
export default function ConsoleLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="console-theme flex flex-1 flex-col">
      <SkipLink />
      {children}
    </div>
  );
}
