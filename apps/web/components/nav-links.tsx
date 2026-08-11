"use client";

/*
 * A client component for one reason: `usePathname`.
 *
 * There is no server equivalent — a layout is not re-rendered per route segment
 * with the path available, and nothing in CSS can know which page it is on. The
 * alternative is a nav that never says where you are, which is the one thing a
 * nav is for. It ships a few hundred bytes and no state.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

// `short` is the collapsed mobile label. Two letters, not one: "Career" and
// "Certificates" share an initial, and a row reading P · C · C gives a sighted
// thumb no way to tell the two apart.
const LINKS = [
  { href: "/#projects", label: "Projects", short: "Pr" },
  { href: "/blog", label: "Blog", short: "Bl" },
  { href: "/career-journey", label: "Career", short: "Ca" },
  { href: "/certificates", label: "Certificates", short: "Ce" },
];

/** The path part of a nav href, so `/#projects` is compared as `/`. */
function pathOf(href: string): string {
  return href.split("#")[0] || "/";
}

/**
 * Whether `pathname` is this entry's page, or a page underneath it.
 *
 * Exact match stopped being enough when one entry got children: a reader on
 * `/blog/some-post` is still in Blog, and a nav that drops its marker the
 * moment you click through tells you less than one that keeps it.
 *
 * `/` is excluded from the prefix half. It is a prefix of every path, and a nav
 * that highlights Projects on every page says nothing — which is what the exact
 * match was guarding against in the first place.
 */
function isCurrent(pathname: string, href: string): boolean {
  const path = pathOf(href);
  return pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => {
        const current = isCurrent(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            // Announced, not just coloured. Colour alone leaves the current page
            // unmarked for anyone using a screen reader, and it is the one piece
            // of state in the header.
            aria-current={current ? "page" : undefined}
            className={cn(
              // min 44×44: padding around a 12px initial only reached 28×36,
              // which is a routine thumb-miss on a phone.
              "relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] px-2.5 font-mono text-xs uppercase tracking-wider transition-colors sm:px-3",
              // The rule sits at the bottom of the label rather than the bottom
              // of the header, because the link is inset from both — a tab
              // indicator floating in the middle of the bar reads as an
              // underline, which is what it is.
              current
                ? "text-primary after:absolute after:inset-x-2.5 after:bottom-1.5 after:h-px after:bg-primary sm:after:inset-x-3"
                : "text-muted-foreground hover:text-primary",
            )}
          >
            {/*
              aria-hidden on the initial: without it the accessible name is
              computed from both spans and reads "P Projects".
            */}
            <span aria-hidden="true" className="sm:hidden">
              {link.short}
            </span>
            <span className="sr-only sm:not-sr-only">{link.label}</span>
          </Link>
        );
      })}
    </>
  );
}
