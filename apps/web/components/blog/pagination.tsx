import Link from "next/link";

import { eyebrowClasses } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";

/**
 * Page links for the ledger.
 *
 * ## Why pages and not infinite scroll
 *
 * A page is a URL. It can be linked, shared, bookmarked, opened in a new tab
 * and returned to by the back button, and it tells the reader how much there is
 * — none of which infinite scroll does. It also needs no JavaScript, which
 * means the index still works when the bundle does not.
 *
 * ## Why the whole set of numbers is rendered
 *
 * Because there are tens of posts, not thousands, so the elision logic that a
 * large set needs would be code with no case to run in. If this ever gets past
 * two or three pages of numbers, that is the point to add it — and the point at
 * which it can be tested.
 */
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  /** 1-based. */
  page: number;
  pageCount: number;
  /** Builds the URL for a page, so each caller keeps its own query string. */
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pages" className="mt-10 flex items-center justify-between gap-4">
      <Step href={page > 1 ? hrefFor(page - 1) : null} label="← Newer" />

      <ul className="flex flex-wrap items-center justify-center gap-1">
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
          <li key={number}>
            <Link
              href={hrefFor(number)}
              aria-current={number === page ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] font-mono text-sm tabular-nums transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                number === page
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {number}
            </Link>
          </li>
        ))}
      </ul>

      <Step href={page < pageCount ? hrefFor(page + 1) : null} label="Older →" />
    </nav>
  );
}

/**
 * One end of the range.
 *
 * A disabled step renders as text rather than as a link with `aria-disabled`.
 * There is no page to go to, so there is nothing to focus — and a focusable
 * control that does nothing is worse than an absent one.
 */
function Step({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <span aria-hidden="true" className={cn(eyebrowClasses, "opacity-40")}>
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        eyebrowClasses,
        "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-1 transition-colors hover:text-primary",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      )}
    >
      {label}
    </Link>
  );
}
