"use client";

/*
 * A client component for one reason: `usePathname`.
 *
 * Same as the public nav — there is no server equivalent, a layout is not
 * re-rendered per segment with the path in hand, and nothing in CSS knows which
 * page it is on. Without it this is a list of links that never says where you
 * are, which is the one thing a nav is for. No state, no effects.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { ENTITIES } from "@/lib/content-schema";

/**
 * The inbox first, because it is the only section that receives things rather
 * than holding things — it is the one with something new in it.
 *
 * Media last, and listed by hand rather than coming from ENTITIES, because it
 * is not a content type: it has no slug, no publish state and no create screen,
 * and forcing it into that description to save a line here would put four
 * meaningless fields on it. It also belongs at the bottom for the same reason
 * it has no upload button — it is where you go to tidy up, not to make
 * something.
 */
const SECTIONS = [
  { href: "/admin", label: "Inbox" },
  ...ENTITIES.map((entity) => ({ href: `/admin/${entity.key}`, label: entity.plural })),
  { href: "/admin/media", label: "Media" },
];

export function ConsoleNav() {
  const pathname = usePathname();

  return (
    // A scrolling row on a phone, a column on a desktop. Wrapping instead would
    // put six items on three ragged lines and push the page down with them.
    <nav
      aria-label="Console sections"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0"
    >
      {SECTIONS.map((section) => {
        // Exact for the inbox, which is /admin and a prefix of every other
        // section; prefix for the rest, so an edit form keeps its section lit.
        const current =
          section.href === "/admin"
            ? pathname === "/admin"
            : pathname === section.href || pathname.startsWith(`${section.href}/`);

        return (
          <Link
            key={section.href}
            href={section.href}
            // Announced, not only coloured — this is the only piece of state in
            // the sidebar, and the stylesheet keys the pill off this attribute
            // so the two cannot disagree.
            aria-current={current ? "page" : undefined}
            className={cn(
              "c-nav-item inline-flex min-h-11 shrink-0 items-center px-3 text-sm lg:w-full",
              current ? "font-medium" : "text-muted-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
