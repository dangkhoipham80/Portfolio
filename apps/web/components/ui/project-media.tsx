import { cn } from "@/lib/cn";

/**
 * The image band on a project card.
 *
 * `image_url` has been in the content model since #17 and nothing rendered it.
 * The complication: no images are committed anywhere in this repo — the seeded
 * paths like `/assets/images/edupath.png` point at files that do not exist, so
 * today every one of them 404s.
 *
 * So the image is painted as a CSS background layered over a generated
 * gradient, rather than as an <img>. A background that fails to load simply
 * does not paint and the gradient shows through — no broken-image icon, no
 * layout shift, no `onError` handler and therefore no client component. When
 * real images do land, the same markup starts showing them with no change here.
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
  className,
}: {
  slug: string;
  title: string;
  imageUrl: string | null;
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

  // Later layers paint on top. The image sits above the gradient, so it wins
  // when it loads and is invisible when it does not.
  const backgroundImage = [
    `url(${JSON.stringify(imageUrl)})`,
    `linear-gradient(${angle}deg, hsl(var(--primary) / 0.22), hsl(var(--primary) / 0.04))`,
  ].join(", ");

  return (
    <div
      className={cn(
        "relative flex aspect-[16/7] items-end overflow-hidden rounded-[var(--radius-control)] border border-border bg-cover bg-center",
        className,
      )}
      style={{ backgroundImage }}
      // The title is already the card's heading right below this; announcing it
      // again here would just make screen readers say everything twice.
      role="presentation"
    >
      <span
        aria-hidden="true"
        className="p-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
      >
        {title}
      </span>
    </div>
  );
}
