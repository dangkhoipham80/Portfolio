import Link from "next/link";

import { ThemeToggle } from "./theme-toggle";
import { Container } from "./ui/container";

const LINKS = [
  { href: "/#projects", label: "Projects" },
  { href: "/career-journey", label: "Career" },
  { href: "/certificates", label: "Certificates" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <Container className="flex items-center justify-between gap-4 py-4">
        <Link
          href="/"
          className="font-display font-semibold tracking-tight text-foreground"
        >
          Phạm Đăng Khôi
        </Link>

        {/*
          Three uppercase mono labels plus the name and the toggle overflowed a
          375px viewport by 3px, which pushed the toggle off-screen entirely.
          Below `sm` the labels collapse to their initials — the destinations
          stay reachable and the accessible name is unchanged, because the full
          word is still in the DOM for assistive tech.
        */}
        <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              // Padding, not just text: a 12px label is not a tap target.
              className="rounded-[--radius-control] px-2.5 py-2.5 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary sm:px-3"
            >
              {/*
                aria-hidden on the initial: without it the accessible name is
                computed from both spans and reads "P Projects".
              */}
              <span aria-hidden="true" className="sm:hidden">
                {link.label.charAt(0)}
              </span>
              <span className="sr-only sm:not-sr-only">{link.label}</span>
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </Container>
    </header>
  );
}
