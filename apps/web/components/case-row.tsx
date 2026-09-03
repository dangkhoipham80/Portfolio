import Image from "next/image";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ExternalLink } from "@/components/ui/external-link";
import { ProjectMedia } from "@/components/ui/project-media";
import { isOptimisableImage } from "@/lib/blob";
import { cn } from "@/lib/cn";
import { formatPeriod } from "@/lib/format";
import type { GalleryImage, Project } from "@/lib/types";
import { ViewTransition } from "@/lib/view-transition";

/*
 * The pieces both case-row layouts share. Components rather than a copied
 * class string because "which links exist" is logic, not styling.
 *
 * No technology chips here, on purpose. The home page used to list five
 * under every title and a tile cluster in the cover; the owner's call is
 * that a project on this page is its description and its cover image, and
 * nothing else. The detail page lists the full stack.
 */

/** The heading, stretched over its row so the whole article is the target. */
function ProjectTitle({ project }: { project: Project }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <h3 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-foreground sm:text-4xl lg:text-5xl">
        <Link
          href={`/projects/${project.slug}`}
          // The ::after stretches this anchor over the row while the link text
          // stays the title, so the accessible name is the project, not "row".
          // `link-draw` underlines from the left while the row is hovered —
          // the title stays ink, the line is the only thing that takes colour.
          className="link-draw after:absolute after:inset-0"
        >
          {project.title}
        </Link>
      </h3>
      <StatusBadge status={project.status} />
    </div>
  );
}

function ProjectLinks({ project, className }: { project: Project; className?: string }) {
  if (!project.github_url && !project.live_url) return null;

  return (
    // z-10 keeps these above the title's stretched link so they stay
    // independently clickable.
    <div className={cn("relative z-10 flex gap-5", className)}>
      {project.github_url ? <ExternalLink href={project.github_url}>Source</ExternalLink> : null}
      {project.live_url ? <ExternalLink href={project.live_url}>Live</ExternalLink> : null}
    </div>
  );
}

/**
 * One supporting screenshot in the strip. The same three-way choice the
 * detail page's gallery makes, for the same reason (see project-gallery.tsx):
 * a gallery URL is free text, and next/image on an unlisted host throws at
 * render rather than degrading.
 */
function StripImage({ image, sizes }: { image: GalleryImage; sizes: string }) {
  const frame =
    "relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted";

  if (!isOptimisableImage(image.url)) {
    return (
      <div className={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.alt ?? ""}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={frame}>
      <Image src={image.url} alt={image.alt ?? ""} fill sizes={sizes} className="object-cover" />
    </div>
  );
}

/**
 * A featured project as a case block: the argument on top, in the gutter,
 * and the evidence underneath as a strip of screens that runs off the right
 * edge of the screen.
 *
 * ## Why not a spread
 *
 * The last layout put the cover on one side and the text on the other, and
 * the owner did not like it — and it was the wrong shape for what a project
 * here is going to hold: one main screenshot and a dozen supporting ones.
 * A half-width panel has room for exactly one image. A strip has room for
 * all of them, in the order the console lists them, and the reader scrolls
 * it sideways the way they would flip through a case study. The main cover
 * is first and largest; the gallery follows at a smaller size so the
 * hierarchy is in the layout, not in a caption.
 *
 * The strip is full bleed on the right only. It begins at the text's left
 * gutter so the cover lines up with the title above it, and it is allowed
 * to run out under the right edge because that is what tells the reader
 * there is more to drag. On the reader's scroll it slides in from that edge
 * (`.spread-media`).
 *
 * ## Before the images arrive
 *
 * Every project currently has `image_url: null` and an empty gallery, and
 * the block is then the title, the description and the links — no panel.
 * Two generated stand-ins were tried (a gradient with a ghost initial, then
 * the stack as tiles) and the owner's call was to show nothing rather than
 * something invented: a project here is its description and its cover.
 * Uploading a cover in the console adds the banner; adding gallery images
 * turns it into the strip. Nothing here changes.
 */
export function CaseRow({
  project,
  priority,
}: {
  project: Project;
  /** True for the first row only — see ProjectMedia's `priority`. */
  priority?: boolean;
}) {
  const period = formatPeriod(project.started_on, project.ended_on);
  const gallery = project.gallery ?? [];
  const hasCover = Boolean(project.image_url);
  // With nothing to scroll to, the cover takes the whole gutter width as a
  // wide banner instead of leaving a third of the strip empty. The moment a
  // gallery image is added the cover narrows and the strip appears.
  const hasStrip = gallery.length > 0;
  const hasMedia = hasCover || hasStrip;

  return (
    // overflow-hidden on the row: the strip arrives from beyond the viewport
    // edge (`.spread-media`), and until the reader scrolls to it that start
    // position would otherwise be 60px of horizontal scrollbar.
    <article className="group relative overflow-hidden border-t border-border/60 py-10 sm:py-14 lg:py-16">
      <Container width="full">
        <div className="reveal-row grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-16">
          <div>
            <Eyebrow>
              /{project.slug}
              {period ? ` · ${period}` : null}
            </Eyebrow>
            <div className="mt-4">
              <ProjectTitle project={project} />
            </div>
          </div>

          <div>
            <p className="max-w-xl text-[1.0625rem] leading-relaxed text-muted-foreground sm:text-lg">
              {project.description}
            </p>
            <ProjectLinks project={project} className="mt-3" />
          </div>
        </div>
      </Container>

      {/*
        The strip. Snap points so a flick lands on an image rather than
        between two; the gutter is scroll padding so the first snap position
        is the aligned one. `scrollbar-width: thin` because the strip is a
        scroll container and hiding the bar entirely would hide the only
        non-drag affordance it has.
      */}
      {hasMedia ? (
      <div className="spread-media mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 [scrollbar-width:thin] sm:mt-10 sm:gap-4 sm:px-8 lg:px-12 [scroll-padding-inline:1.25rem] sm:[scroll-padding-inline:2rem] lg:[scroll-padding-inline:3rem]">
        {hasCover ? (
          <div
            className={cn(
              "shrink-0 snap-start",
              hasStrip ? "w-[86vw] max-w-[72rem] sm:w-[74vw] lg:w-[62vw]" : "w-full",
            )}
          >
            {/* Shared-element morph: this panel and the detail page's header
                carry the same transition name, so clicking through animates
                the panel into the header instead of cutting. */}
            <ViewTransition name={`project-media-${project.slug}`}>
              <ProjectMedia
                slug={project.slug}
                title={project.title}
                imageUrl={project.image_url}
                priority={priority}
                className={cn(
                  "w-full transition-transform duration-700 ease-out group-hover:scale-[1.01]",
                  hasStrip ? "aspect-[16/9]" : "aspect-[16/10] sm:aspect-[21/9] lg:aspect-[3/1]",
                )}
              />
            </ViewTransition>
          </div>
        ) : null}

        {gallery.map((image) => (
          <div
            key={image.url}
            className="w-[70vw] shrink-0 snap-start sm:w-[44vw] lg:w-[30vw] lg:max-w-[36rem]"
          >
            <StripImage image={image} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 44vw, 70vw" />
          </div>
        ))}
      </div>
      ) : null}
    </article>
  );
}

/**
 * The rest of the work, as a compact index: everything a case row carries,
 * at one line's cost. The two presentations split on `featured` — the owner
 * already curates that flag in the console.
 */
export function ProjectIndexRow({ project }: { project: Project }) {
  return (
    <article className="group relative grid gap-1 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6">
      <div>
        <h3 className="inline font-display text-lg font-semibold text-foreground">
          <Link
            href={`/projects/${project.slug}`}
            className="link-draw after:absolute after:inset-0"
          >
            {project.title}
          </Link>
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {project.technologies.slice(0, 3).join(" · ")}
      </p>
    </article>
  );
}
