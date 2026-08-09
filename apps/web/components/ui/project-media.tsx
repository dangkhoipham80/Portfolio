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
  className,
}: {
  slug: string;
  title: string;
  imageUrl: string | null;
  className?: string;
}) {
  // No image on the record means draw nothing. The gradient exists to cover an
  // image that fails to *load*, not to fill space where the data says there is
  // no image — every card carrying an identical empty pastel box looked like a
  // grid of failed downloads, which is worse than a card with no media at all.
  if (!imageUrl) return null;

  const angle = angleFromSlug(slug);

  // Later layers paint on top. The image sits above the gradient, so it wins
  // when it loads and is invisible when it does not.
  const backgroundImage = [
    `url(${JSON.stringify(imageUrl)})`,
    `linear-gradient(${angle}deg, hsl(var(--primary) / 0.22), hsl(var(--primary) / 0.04))`,
  ].join(", ");

  return (
    <div
      className={cn(
        "relative flex aspect-[16/7] items-end overflow-hidden rounded-[--radius-control] border border-border bg-cover bg-center",
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
