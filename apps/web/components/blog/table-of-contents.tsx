"use client";

// A client component for one reason: marking which section you are currently
// in needs to observe scroll position, and there is no CSS that can do it.
// Without JavaScript this still renders as a working list of anchor links.

import { useEffect, useState } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { type Heading, hasContents } from "@/lib/headings";

/**
 * The post's headings, in the left margin.
 *
 * ## Why the margin instead of a box at the top
 *
 * A contents list at the top of an article is read once and then scrolled past.
 * In the margin it stays useful for the whole post — which is the only argument
 * for having one at all, and the reason it is worth a client component.
 *
 * ## Why it disappears for short posts
 *
 * Three headings on a post you can read in four minutes is furniture. The
 * threshold is `hasContents` in lib/markdown.ts, shared with the page — which
 * has to make the same decision to stop reserving the column this sits in.
 */
export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!hasContents(headings)) return;

    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) return;

    /*
      `rootMargin` pulls the observation band up to a strip near the top of the
      viewport, so "current" means the heading you have most recently scrolled
      past rather than whichever one happens to be visible — with a whole
      viewport as the band, a short section and the one after it are both on
      screen and the highlight flickers between them.

      Reading `boundingClientRect` rather than trusting entry order: the
      observer reports entries in whatever order they changed, so the topmost
      visible heading has to be worked out rather than assumed.
    */
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [headings]);

  if (!hasContents(headings)) return null;

  return (
    <nav aria-label="On this page" className="lg:sticky lg:top-24">
      <Eyebrow className="mb-3">On this page</Eyebrow>
      <ul className="space-y-1 border-l border-border">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              // aria-current so the marker is not colour and weight alone —
              // which section you are in is state, and it has to be readable.
              aria-current={active === heading.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 py-1.5 pl-3 text-sm transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                heading.level === 3 && "pl-6",
                active === heading.id
                  ? "border-l-foreground text-foreground"
                  : "border-l-transparent text-muted-foreground hover:border-l-border hover:text-foreground",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
