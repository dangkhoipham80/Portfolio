import Image from "next/image";

import { eyebrowClasses } from "@/components/ui/eyebrow";
import { isOptimisableImage } from "@/lib/blob";
import { cn } from "@/lib/cn";

/**
 * The image band on a project card.
 *
 * ## Three renderings, picked by what the record actually holds
 *
 * 1. **No image** — the project's stack, drawn as the chain of services it is
 *    (see `StackCover` below), but only where a `cover` was asked for.
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
 * The stack, as a request path.
 *
 * Every project on this site currently has `image_url: null`, and a
 * placeholder gradient with a ghosted initial in it was the honest but
 * underwhelming answer: it said "no picture" in five different colours. This
 * says something true instead. A project's stack *is* a chain of services a
 * request passes through, so the cover draws it as one — in exactly the
 * vocabulary the hero uses for this site's own request path, so the covers
 * and the hero read as the same drawing at two scales.
 *
 * Up to four services, folded into a serpentine for the same reason the hero
 * is: long open wires between the nodes, so the packet that runs them is
 * visible for most of its journey. The wires draw in as the row scrolls into
 * view and the packet is pushed along by the reader's own scrolling; under the
 * pointer the wires go live. All CSS — the SVG is server-rendered and static.
 * ----------------------------------------------------------------------- */

const COVER_W = 360;
const COVER_H = 180;
const NODE_H = 30;
const ROW_Y = [30, 120] as const;
const EDGE_INSET = 8;
/** Mono at 11px runs about 6.6px per character; the padding is the hero's. */
const CHAR_W = 6.6;
const NODE_PAD = 24;
const MAX_LABEL = 16;
const COVER_NODES = 4;

type CoverNode = { label: string; x: number; y: number; w: number };

function fitLabel(label: string): string {
  return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;
}

/**
 * Lay the first four technologies out as two rows, right-to-left on the second
 * so the chain folds. Each column shares a centre line so the vertical wire is
 * vertical whatever the two labels' widths are.
 */
function layoutStack(technologies: string[]): {
  nodes: CoverNode[];
  /** Each wire with its length, which the draw and flow animations need in real units. */
  edges: { d: string; len: number }[];
  packetPath: string | null;
} {
  const labels = technologies.slice(0, COVER_NODES).map(fitLabel);
  const widths = labels.map((l) => Math.max(64, Math.round(l.length * CHAR_W + NODE_PAD)));

  const leftCentre = EDGE_INSET + Math.max(widths[0] ?? 0, widths[3] ?? 0) / 2;
  const rightCentre = COVER_W - EDGE_INSET - Math.max(widths[1] ?? 0, widths[2] ?? 0) / 2;
  const centres = [leftCentre, rightCentre, rightCentre, leftCentre];

  const nodes: CoverNode[] = labels.map((label, i) => ({
    label,
    w: widths[i],
    x: centres[i] - widths[i] / 2,
    y: ROW_Y[i < 2 ? 0 : 1],
  }));

  const mid = (n: CoverNode) => n.y + NODE_H / 2;
  const edges: { d: string; len: number }[] = [];
  const path: string[] = [];

  if (nodes.length >= 2) {
    const from = nodes[0].x + nodes[0].w;
    edges.push({ d: `M${from},${mid(nodes[0])} L${nodes[1].x},${mid(nodes[1])}`, len: nodes[1].x - from });
    path.push(`M${from},${mid(nodes[0])}`, `L${rightCentre},${mid(nodes[1])}`);
  }
  if (nodes.length >= 3) {
    const from = nodes[1].y + NODE_H;
    edges.push({ d: `M${rightCentre},${from} L${rightCentre},${nodes[2].y}`, len: nodes[2].y - from });
    path.push(`L${rightCentre},${mid(nodes[2])}`);
  }
  if (nodes.length >= 4) {
    const to = nodes[3].x + nodes[3].w;
    edges.push({ d: `M${nodes[2].x},${mid(nodes[2])} L${to},${mid(nodes[3])}`, len: nodes[2].x - to });
    path.push(`L${to},${mid(nodes[3])}`);
  }

  return { nodes, edges, packetPath: path.length > 1 ? path.join(" ") : null };
}

function StackCover({
  slug,
  technologies,
  className,
}: {
  slug: string;
  technologies: string[];
  className?: string;
}) {
  const { nodes, edges, packetPath } = layoutStack(technologies);
  const remainder = technologies.length - nodes.length;

  // Where the light falls on this panel: one of the upper corners, biased so
  // neighbouring covers are not lit identically. Inline because the values
  // are per record and Tailwind's scanner would never see them.
  const lightX = `${Math.round(10 + unitFromSlug(slug, 7) * 40)}%`;
  const lightY = `${Math.round(unitFromSlug(slug, 13) * 30)}%`;

  return (
    <div
      className={cn(
        "cover-lit relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border/60",
        className,
      )}
      style={{ "--light-x": lightX, "--light-y": lightY } as React.CSSProperties}
      role="presentation"
    >
      <svg
        viewBox={`0 0 ${COVER_W} ${COVER_H}`}
        aria-hidden="true"
        className="h-full w-full flex-1 p-4 sm:p-5"
        preserveAspectRatio="xMidYMid meet"
      >
        {edges.map((edge) => (
          <path
            key={edge.d}
            d={edge.d}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
            className="cover-edge"
            // Real length rather than `pathLength="1"`: the hover flow's dash
            // pattern is in user units, and a `3 9` dash on a path normalised
            // to 1 is a solid line. See `.cover-edge` in globals.css.
            style={{ "--len": edge.len } as React.CSSProperties}
          />
        ))}

        {/* Drawn before the nodes, so it passes behind each service. */}
        {packetPath ? (
          <circle
            r="3.5"
            fill="hsl(var(--sig-cool))"
            className="cover-packet"
            style={{ offsetPath: `path("${packetPath}")` }}
          />
        ) : null}

        {nodes.map((node) => (
          <g key={node.label}>
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={NODE_H}
              rx="8"
              fill="hsl(var(--background))"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
            />
            <text
              x={node.x + node.w / 2}
              y={node.y + NODE_H / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="hsl(var(--foreground))"
              className="font-mono text-[11px]"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>

      <p
        aria-hidden="true"
        className={cn(eyebrowClasses, "flex justify-between border-t border-border/40 px-4 py-2.5")}
      >
        <span>/{slug}</span>
        {remainder > 0 ? <span>+{remainder} more</span> : null}
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
  /** What the generated cover draws when there is no image. */
  technologies?: string[];
  /**
   * Set on the first case row only. That panel is usually the page's LCP once
   * real covers exist, and everything below it should stay lazy — marking them
   * all `priority` would queue five full-width images against the hero.
   */
  priority?: boolean;
  /**
   * Draw the stack as a cover when the record has no image. Off by default:
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
