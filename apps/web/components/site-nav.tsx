import Link from "next/link";

import { ConsoleLink } from "./console-link";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { Container } from "./ui/container";

/*
 * The header is a pane of the page, not a separate surface: translucent ink
 * with a blur, so content slides beneath it, and a half-strength hairline
 * marking its lower edge. `bg-background/85` rather than `bg-card` — with the
 * grid texture faded to atmosphere the old read-through problem is gone, and
 * a card-coloured bar across the top of an ink page looked like a browser
 * toolbar.
 */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <Container width="full" className="flex items-center justify-between gap-3 py-3 sm:gap-4">
        <Link
          href="/"
          // min-h-11 is the tap target: as bare text the name measured 40px
          // tall sitting next to a row of 44px controls.
          className="inline-flex min-h-11 items-center font-display font-bold tracking-tight text-foreground"
        >
          Phạm Đăng Khôi
          {/* The terminal dot: the name ends at a node, like every path on
              this site. Amber, mark-sized, never text. */}
          <span aria-hidden="true" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-signal" />
        </Link>

        <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-2">
          {/* Desktop links; phone widths get the overlay menu instead. */}
          <span className="hidden sm:contents">
            <NavLinks />
          </span>

          {/*
            A hairline between the places you can go and the switches that act
            on the site. Without it the console key reads as a fifth
            destination, which it is not.
          */}
          <span aria-hidden="true" className="mx-2 hidden h-5 w-px bg-border sm:block" />

          {/* The console key stays desktop-only; the overlay menu and the
              footer carry the phone-width way in. */}
          <span className="hidden sm:flex">
            <ConsoleLink />
          </span>

          <ThemeToggle />

          <MobileMenu />
        </nav>
      </Container>
    </header>
  );
}
