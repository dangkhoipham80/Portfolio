"use client";

// A client component for one reason: marking which section you are currently
// in needs to observe scroll position, and there is no CSS that can do it.
// Without JavaScript this still renders as a working list of anchor links.

import { useEffect, useRef, useState } from "react";

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
 *
 * ## The marker
 *
 * One node travels the rail rather than each entry lighting its own border:
 * the same spine-and-junction vocabulary as the home page, and a single
 * element sliding between headings says "you moved" in a way that two
 * borders swapping colour does not. Its position is measured from the
 * entry's own offset, so a wrapped heading or an indented h3 is handled
 * without a lookup table. Under reduced motion the transition is zeroed by
 * the global rule and the node simply jumps.
 */
export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [marker, setMarker] = useState<{ top: number; height: number } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

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

  // The marker follows the active entry. Measured, not computed from the
  // index: entries wrap, and an h3 is indented, so their heights differ.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !active) return;

    const entry = list.querySelector<HTMLElement>(`[data-heading="${CSS.escape(active)}"]`);
    if (!entry) return;

    setMarker({ top: entry.offsetTop, height: entry.offsetHeight });
  }, [active]);

  if (!hasContents(headings)) return null;

  return (
    <nav aria-label="On this page">
      <Eyebrow className="mb-3">On this page</Eyebrow>
      <ul ref={listRef} className="relative space-y-1 border-l border-border">
        {/*
          The travelling node. Positioned from the list's top and moved with
          `translate`, which the compositor animates; `top` would re-lay the
          list out on every frame of the slide.
        */}
        {marker ? (
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 w-0.5 -translate-x-1/2 rounded-full bg-signal transition-[translate,height] duration-300 ease-[var(--ease-enter)]"
            style={{ translate: `-50% ${marker.top}px`, height: marker.height }}
          />
        ) : null}

        {headings.map((heading) => (
          <li key={heading.id} data-heading={heading.id}>
            <a
              href={`#${heading.id}`}
              // aria-current so the marker is not colour and weight alone —
              // which section you are in is state, and it has to be readable.
              aria-current={active === heading.id ? "location" : undefined}
              className={cn(
                "block py-1.5 pl-4 text-sm transition-[color,translate] duration-300 ease-[var(--ease-enter)] hover:translate-x-0.5",
                heading.level === 3 && "pl-7",
                active === heading.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
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
