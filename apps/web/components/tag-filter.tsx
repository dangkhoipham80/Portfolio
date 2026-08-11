import Link from "next/link";

import { Badge } from "@/components/ui/badge";

/**
 * The blog index's tag facets.
 *
 * Links, not buttons, and no client component: each facet is a URL that can be
 * shared, linked and opened in a new tab, and the page it leads to is rendered
 * on the server. A `useState` filter would have thrown all of that away to
 * avoid a navigation nobody minds.
 */
export function TagFilter({ tags, active }: { tags: string[]; active?: string }) {
  if (tags.length === 0) return null;

  return (
    <nav aria-label="Filter posts by tag" className="flex flex-wrap items-center gap-x-2">
      <Facet href="/blog" label="All" active={!active} />
      {tags.map((tag) => (
        <Facet
          key={tag}
          href={`/blog?tag=${encodeURIComponent(tag)}`}
          label={tag}
          active={tag === active}
        />
      ))}
    </nav>
  );
}

function Facet({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      // aria-current, not colour alone: which facet is applied is the only
      // state on this page, and it has to survive being read out loud.
      aria-current={active ? "true" : undefined}
      // The link carries the tap target and the badge carries the look. A
      // Badge on its own is about 20px tall and, for a short label like "All",
      // 36px wide — neither of which is something a thumb can reliably hit.
      // Both minimums are needed: height alone left "All" at 36×44.
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-pill)]"
    >
      {/*
        The applied facet is a filled chip, not a tinted one. Tinted was the
        first attempt — `text-primary` on `bg-primary/12` — and it measured
        4.25:1 in light mode, under the 4.5:1 that 12px text needs. Filling it
        uses the primary/primary-foreground pairing the palette already tunes
        for both themes, and "selected" is what a filled chip means anyway.
      */}
      <Badge
        variant={active ? "neutral" : "outline"}
        className={
          active
            ? "bg-primary text-primary-foreground"
            : "transition-colors hover:border-primary/50 hover:text-primary"
        }
      >
        {label}
      </Badge>
    </Link>
  );
}
