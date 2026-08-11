"use client";

/*
 * A client component for one reason: `usePathname`.
 *
 * Same as the public nav — there is no server equivalent, a layout is not
 * re-rendered per segment with the path in hand, and nothing in CSS knows which
 * page it is on. Without it this is a row of links that never says where you
 * are, which is the one thing a nav is for. No state, no effects.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { ENTITIES } from "@/lib/content-schema";

/**
 * The inbox first, because it is the only section that receives things rather
 * than holding things — it is the one with something new in it.
 */
const SECTIONS = [
  { href: "/admin", label: "Inbox" },
  ...ENTITIES.map((entity) => ({ href: `/admin/${entity.key}`, label: entity.plural })),
];

export function ConsoleNav() {
  const pathname = usePathname();

  return (
    // A horizontal strip, not a sidebar. A left rail is the reflex for an admin
    // area and is the one shape that says "generic dashboard"; this site's
    // vocabulary is mono status rows, and the layout above is already one.
    // overflow-x-auto rather than wrapping: at 375px six sections wrap to three
    // ragged lines, and a scrolling row keeps the strip one row tall everywhere.
    <nav
      aria-label="Console sections"
      className="flex gap-1 overflow-x-auto border-b border-border bg-card/30"
    >
      {SECTIONS.map((section) => {
        // Exact for the inbox, which is /admin and a prefix of everything else;
        // prefix for the rest, so an edit form keeps its section marked.
        const current =
          section.href === "/admin"
            ? pathname === "/admin"
            : pathname === section.href || pathname.startsWith(`${section.href}/`);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-11 shrink-0 items-center px-4 font-mono text-xs uppercase tracking-[0.18em] transition-colors",
              current
                ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-primary"
                : "text-muted-foreground hover:text-primary",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
