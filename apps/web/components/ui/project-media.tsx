import Image from "next/image";

import { isOptimisableImage } from "@/lib/blob";
import { cn } from "@/lib/cn";

/**
 * The image band on a project card.
 *
 * ## Three renderings, picked by what the record actually holds
 *
 * 1. **No image** — a designed generative cover (slug-derived gradient, ghost
 *    initial, slug), but only where a `cover` was asked for.
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
 *
 * The gradient angle is derived from the slug so each project reads as its own
 * tile, but the colours stay on the site's palette — this is meant to look
 * deliberate, not like five random swatches.
 */

function angleFromSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 360;
  }
  return hash;
}

export function ProjectMedia({
  slug,
  title,
  imageUrl,
  cover = false,
  priority = false,
  className,
}: {
  slug: string;
  title: string;
  imageUrl: string | null;
  /**
   * Set on the first case row only. That panel is usually the page's LCP once
   * real covers exist, and everything below it should stay lazy — marking them
   * all `priority` would queue five full-width images against the hero.
   */
  priority?: boolean;
  /**
   * Render a designed generative cover when the record has no image. Off by
   * default: in a dense grid an identical box per card reads as a grid of
   * failed downloads. A case row is different — the layout promises a spread,
   * so the panel must exist, and the cover below is composed (ghost initial,
   * slug, slug-derived gradient) rather than an empty swatch.
   */
  cover?: boolean;
  className?: string;
}) {
  // No image on the record means draw nothing — unless a cover was asked for.
  if (!imageUrl && !cover) return null;

  const angle = angleFromSlug(slug);

  if (!imageUrl) {
    return (
      <div
        className={cn(
          "relative flex aspect-video items-end overflow-hidden rounded-[var(--radius-card)] border border-border/60",
          className,
        )}
        style={{
          backgroundImage: `linear-gradient(${angle}deg, hsl(var(--primary) / 0.16), hsl(var(--primary) / 0.03) 60%)`,
        }}
        role="presentation"
      >
        {/* The project's initial as a ghosted plate mark — cover art the data
            cannot fail to provide. */}
        <span
          aria-hidden="true"
          className="absolute -right-5 top-1/2 -translate-y-1/2 select-none font-display text-[9rem] font-extrabold leading-none text-foreground/[0.06] sm:text-[12rem]"
        >
          {title.slice(0, 1)}
        </span>
        <span
          aria-hidden="true"
          className="p-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
        >
          /{slug}
        </span>
      </div>
    );
  }

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
           * The panel is half the layout at `lg` and full width below it.
           * Without this, next/image assumes 100vw everywhere and ships a
           * desktop-width file to fill a 700px column.
           */
          sizes="(min-width: 1024px) 46rem, 100vw"
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
    `linear-gradient(${angle}deg, hsl(var(--primary) / 0.22), hsl(var(--primary) / 0.04))`,
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
