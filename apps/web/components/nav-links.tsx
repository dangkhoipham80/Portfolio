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

/*
 * Shared with the mobile overlay menu, which renders the same destinations at
 * a different scale — one list, two presentations, so they cannot drift.
 *
 * Certificates is deliberately absent: supporting evidence, not headline
 * content for a mid-level+ candidate. The footer carries it.
 */
export const LINKS = [
  { href: "/#projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/career-journey", label: "Career" },
  // Last, where a "get in touch" belongs: the destination you reach once the
  // rest has done its work.
  { href: "/contact", label: "Contact" },
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
export function isCurrent(pathname: string, href: string): boolean {
  const path = pathOf(href);
  return pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));
}

/**
 * The desktop link row. Hidden below `sm` — those widths get the overlay menu
 * instead of the old two-letter-initials compromise, which saved the pixels
 * but read as a rendering bug.
 */
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
              "relative inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 font-mono text-xs uppercase tracking-wider transition-colors",
              // The current page docks to the nav the way a section docks to
              // the spine: a small amber node under the label, not an
              // underline — same vocabulary as the rest of the site.
              current
                ? "text-primary after:absolute after:bottom-1.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-signal"
                : "text-muted-foreground hover:text-primary",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
