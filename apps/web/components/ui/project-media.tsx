import Image from "next/image";
import type { CSSProperties } from "react";

import { eyebrowClasses } from "@/components/ui/eyebrow";
import { isOptimisableImage } from "@/lib/blob";
import { cn } from "@/lib/cn";

/**
 * The image band on a project card.
 *
 * ## Three renderings, picked by what the record actually holds
 *
 * 1. **No image** — the project's stack, laid out as a cluster of tiles on a
 *    lit panel (see `StackCover` below), but only where a `cover` was asked
 *    for.
 * 2. **An uploaded image** — `next/image`, so it is resized, served as AVIF or
 *    WebP, and lazy below the fold. This is the path the console's upload
 *    button produces and the one that should be normal.
 * 3. **Any other URL** — painted as a CSS background instead.
 *
 * That third case is not legacy tolerance, it is the site's rule about data it
 * does not control. `image_url` is free text: an admin can paste a link to
 * anything, and the seeded rows once pointed at `/assets/images/*.png` files
 * that were never committed. Handing such a URL to `next/image` throws at
 * render and takes the whole page down for one bad string. A background that
 * fails to load simply does not paint, the gradient shows through, and there is
 * no broken-image icon, no layout shift, and no `onError` handler — so no
 * client component either.
 */

/** A stable number in [0, 1) from a slug, so a cover looks the same on every render. */
function unitFromSlug(slug: string, salt: number): number {
  let hash = salt;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 1000003;
  }
  return (hash % 1000) / 1000;
}

/* --------------------------------------------------------------------------
 * The stack, as a cluster.
 *
 * Every project on this site currently has `image_url: null`. The first
 * answer to that was a placeholder gradient with a ghosted initial, which
 * read as a broken image. The second drew the technologies as a chain of
 * services with a packet running between them — the hero's vocabulary at a
 * second scale — and the owner's verdict was that it wired the skills up
 * "all over the place": Java Servlet → JSP → HTML → CSS is not a path a
 * request takes, and a diagram that draws one is a lie told in the site's
 * most honest idiom.
 *
 * So no wires. The stack is what the record holds, and it is shown as what
 * it is: a set. Up to six technologies as large mono tiles, centred on the
 * lit panel, the rest as a count. The tiles arrive one after another on the
 * reader's scroll (`.stagger`), which is all the motion a list needs.
 * ----------------------------------------------------------------------- */

const COVER_TILES = 6;

function StackCover({
  slug,
  technologies,
  className,
}: {
  slug: string;
  technologies: string[];
  className?: string;
}) {
  const shown = technologies.slice(0, COVER_TILES);
  const remainder = technologies.length - shown.length;

  // Where the light falls on this panel: one of the upper corners, biased so
  // neighbouring covers are not lit identically. Inline because the values
  // are per record and Tailwind's scanner would never see them.
  const lightX = `${Math.round(10 + unitFromSlug(slug, 7) * 40)}%`;
  const lightY = `${Math.round(unitFromSlug(slug, 13) * 30)}%`;

  const tile =
    "inline-flex items-center rounded-[var(--radius-control)] border px-4 py-2.5 font-mono text-sm sm:px-5 sm:py-3 sm:text-base lg:px-6 lg:py-3.5 lg:text-lg";

  return (
    <div
      className={cn(
        "cover-lit relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border/60",
        className,
      )}
      style={{ "--light-x": lightX, "--light-y": lightY } as CSSProperties}
      role="presentation"
    >
      <ul className="stagger flex flex-1 flex-wrap content-center items-center justify-center gap-2.5 p-8 sm:gap-3 sm:p-12">
        {shown.map((tech, i) => (
          <li
            key={tech}
            style={{ "--i": i } as CSSProperties}
            className={cn(tile, "border-border/70 bg-background/80 text-foreground")}
          >
            {tech}
          </li>
        ))}
        {remainder > 0 ? (
          <li
            style={{ "--i": shown.length } as CSSProperties}
            className={cn(tile, "border-dashed border-border/70 text-muted-foreground")}
          >
            +{remainder} more
          </li>
        ) : null}
      </ul>

      <p
        aria-hidden="true"
        className={cn(eyebrowClasses, "flex justify-between border-t border-border/40 px-5 py-3")}
      >
        <span>/{slug}</span>
        <span>
          {technologies.length} in the stack
        </span>
      </p>
    </div>
  );
}

export function ProjectMedia({
  slug,
  title,
  imageUrl,
  technologies = [],
  cover = false,
  priority = false,
  className,
}: {
  slug: string;
  title: string;
  imageUrl: string | null;
  /** What the generated cover shows when there is no image. */
  technologies?: string[];
  /**
   * Set on the first case row only. That panel is usually the page's LCP once
   * real covers exist, and everything below it should stay lazy — marking them
   * all `priority` would queue five full-width images against the hero.
   */
  priority?: boolean;
  /**
   * Show the stack as a cover when the record has no image. Off by default:
   * in a dense grid an identical panel per card reads as a grid of failed
   * downloads. A case row is different — the layout promises a spread, so the
   * panel must exist, and what it shows is real content rather than a swatch.
   */
  cover?: boolean;
  className?: string;
}) {
  // No image on the record means draw nothing — unless a cover was asked for.
  if (!imageUrl && !cover) return null;

  if (!imageUrl) {
    return <StackCover slug={slug} technologies={technologies} className={className} />;
  }

  const angle = Math.round(unitFromSlug(slug, 1) * 360);

  const tile =
    "relative flex items-end overflow-hidden rounded-[var(--radius-control)] border border-border";

  /*
   * The caption both branches share: the title, restated over the panel. It is
   * aria-hidden because the card's own heading is directly below.
   *
   * ## The scrim is not decoration
   *
   * This used to be `text-muted-foreground` sitting directly on the image. That
   * is fine on the dark photo you happen to test with and fails on everything
   * else: measured on a white cover it came out at 2.33:1, against the 4.5:1
   * this size of text needs. The covers being uploaded are screenshots of web
   * apps, which are mostly light — so the failing case is the normal one, and
   * it was invisible while every record had `image_url: null`.
   *
   * Over an image the caption stops following the theme, because the photo is
   * its background rather than the page: light text on a dark scrim in both
   * modes. `black`/`white` rather than tokens is deliberate and is not the
   * literal-instead-of-token bug — there is no "darken an arbitrary
   * photograph" surface in the palette, and a scrim that flipped with the
   * theme would be unreadable in one of them.
   */
  const caption = (
    <>
      <span
        aria-hidden="true"
        /*
         * `bg-linear-to-t`, not `bg-gradient-to-t`. Tailwind v4 renamed the
         * gradient utilities, and the v3 name emits no `background-image` at
         * all — the element was there, styled, and completely invisible, which
         * is the same silent failure as `rounded-[--radius-card]`. Verified by
         * reading `backgroundImage` off getComputedStyle, not by reading the
         * class name.
         *
         * `inset-0` rather than `bottom-0 h-1/2`: a percentage height inside an
         * aspect-ratio box resolved to zero, so the span measured 0x0. The
         * gradient is transparent across the top half anyway, so covering the
         * whole tile paints the same thing without depending on how the
         * parent's height was arrived at.
         */
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/35 via-18% to-transparent to-36%"
      />
      <span
        aria-hidden="true"
        className="relative z-10 p-3 font-mono text-xs uppercase tracking-[0.18em] text-white/90 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]"
      >
        {title}
      </span>
    </>
  );

  if (isOptimisableImage(imageUrl)) {
    return (
      <div className={cn(tile, "aspect-[16/7] bg-muted", className)} role="presentation">
        <Image
          src={imageUrl}
          // Decorative here: the title is the heading beside this panel, and
          // repeating it would make a screen reader say everything twice.
          alt=""
          fill
          /*
           * The panel is a little over half the viewport at `lg` and full
           * width below it. Without this, next/image assumes 100vw everywhere
           * and ships a desktop-width file to fill a phone.
           */
          sizes="(min-width: 1024px) 55vw, 100vw"
          priority={priority}
          className="object-cover"
        />
        {caption}
      </div>
    );
  }

  // Later layers paint on top. The image sits above the gradient, so it wins
  // when it loads and is invisible when it does not.
  const backgroundImage = [
    `url(${JSON.stringify(imageUrl)})`,
    `linear-gradient(${angle}deg, hsl(var(--sig-cool) / 0.22), hsl(var(--sig-warm) / 0.08))`,
  ].join(", ");

  return (
    <div
      className={cn(tile, "aspect-[16/7] bg-cover bg-center", className)}
      style={{ backgroundImage }}
      role="presentation"
    >
      {caption}
    </div>
  );
}
