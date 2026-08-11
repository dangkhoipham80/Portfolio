import Link from "next/link";

import { ConsoleLink } from "./console-link";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { Container } from "./ui/container";

/*
 * `bg-card`, not a translucent `bg-background`.
 *
 * The page is graph paper — a repeating grid painted on the body — and the
 * header used to sit on it at 85% opacity, so the grid lines ran straight
 * through the bar. In dark mode you could read them behind the nav. The header
 * stopped being a surface and became more paper, which left the border doing
 * all the work of separating the two, at 60% opacity.
 *
 * `card` is the token the site already uses for anything that sits *on* the
 * paper, and it differs from `background` in both themes — white against a
 * green tint in light, a lighter slate against near-black in dark. At 92% with
 * the blur it still softens what scrolls underneath, but the grid no longer
 * reads through it.
 */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/92 backdrop-blur">
      <Container width="layout" className="flex items-center justify-between gap-3 py-3 sm:gap-4">
        <Link
          href="/"
          // min-h-11 is the tap target: as bare text the name measured 40px
          // tall sitting next to a row of 44px controls.
          className="inline-flex min-h-11 items-center font-display font-semibold tracking-tight text-foreground"
        >
          Phạm Đăng Khôi
        </Link>

        {/*
          Three uppercase mono labels plus the name and the toggle overflowed a
          375px viewport by 3px, which pushed the toggle off-screen entirely.
          Below `sm` the labels collapse to their initials — the destinations
          stay reachable and the accessible name is unchanged, because the full
          word is still in the DOM for assistive tech.

          The links themselves are a client component so they can mark the page
          you are on; see the note in nav-links.tsx.
        */}
        <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-2">
          <NavLinks />

          {/*
            A hairline between the places you can go and the switches that act
            on the site. Without it the console key reads as a fourth
            destination, which it is not — and the theme toggle has always been
            slightly odd sitting at the end of a list of pages.
          */}
          <span aria-hidden="true" className="mx-2 hidden h-5 w-px bg-border sm:block" />

          {/*
            Not in the header below `sm`, and this is a measurement rather than
            a preference: the name is 104px, the nav 239px and the gap 12px,
            against a 320px content box at 375px. It was already 3px from
            overflowing before this control existed — which is why the labels
            collapse to initials at all — and adding a sixth 44px target puts it
            35px over, which no amount of tightening recovers without dropping
            the tap targets under 44px or shrinking the name to initials.

            The footer's Console link is the way in on a phone. It is the same
            destination and the same word, and administering a site from a phone
            is the rarer case anyway.
          */}
          <span className="hidden sm:flex">
            <ConsoleLink />
          </span>

          <ThemeToggle />
        </nav>
      </Container>
    </header>
  );
}
