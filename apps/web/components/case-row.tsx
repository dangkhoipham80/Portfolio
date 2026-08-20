import Link from "next/link";

import { StatusBadge, chipClasses } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ExternalLink } from "@/components/ui/external-link";
import { ProjectMedia } from "@/components/ui/project-media";
import { cn } from "@/lib/cn";
import { formatPeriod } from "@/lib/format";
import type { Project } from "@/lib/types";
import { ViewTransition } from "@/lib/view-transition";

/**
 * How many technology chips a case row shows before it stops counting.
 *
 * This row used to render every one, which meant eleven identical chips under
 * EduPath and Food Forum and nine under Cenematic. Past about five they stop
 * being read: they are all the same size, weight and colour, so the eye takes
 * them as one grey texture and the two that actually matter are buried in it.
 * A wall of chips also reads as a generated interface rather than an edited
 * one — someone chose to list eleven things, or nobody chose anything.
 *
 * The remainder is shown as a count rather than dropped silently, and the
 * detail page still lists the full stack, so nothing becomes unreachable.
 */
const CASE_ROW_CHIPS = 5;

/*
 * The three pieces both case-row layouts share.
 *
 * They are components rather than a copied class string because the capping
 * rule above and the "which links exist" question are logic, not styling —
 * duplicating them is how the two layouts would end up disagreeing about how
 * many chips is too many.
 */

/** The heading, stretched over its row so the whole article is the target. */
function ProjectTitle({ project }: { project: Project }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h3 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        <Link
          href={`/projects/${project.slug}`}
          // The ::after stretches this anchor over the row while the link text
          // stays the title, so the accessible name is the project, not "row".
          className="after:absolute after:inset-0 hover:text-primary"
        >
          {project.title}
        </Link>
      </h3>
      <StatusBadge status={project.status} />
    </div>
  );
}

function TechChips({ technologies, className }: { technologies: string[]; className?: string }) {
  if (technologies.length === 0) return null;

  const shown = technologies.slice(0, CASE_ROW_CHIPS);
  const remainder = technologies.length - shown.length;

  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((tech) => (
        <li key={tech} className={chipClasses}>
          {tech}
        </li>
      ))}
      {remainder > 0 ? (
        <li className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          +{remainder}
        </li>
      ) : null}
    </ul>
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
 * A featured project, in one of two layouts picked by whether the record
 * actually has a cover.
 *
 * ## Why the layout follows the data
 *
 * With a cover, this is a spread: the image beside the argument for it,
 * alternating sides so the section reads as a sequence rather than a grid of
 * tiles. The grid treats every project as the same size; featured work is not
 * the same size, and the spread is the layout saying so.
 *
 * Without one, the spread is the wrong promise. Every project on this site
 * currently has `image_url: null`, so the media column rendered a generated
 * gradient — and four of them stacked meant roughly 40% of the page's area was
 * an empty grey panel with a ghosted letter in it. A placeholder that large
 * does not read as "a cover is coming", it reads as a broken image, and no
 * amount of motion elsewhere rescues a page built mostly of them.
 *
 * So a project without a cover gets a record layout instead: the same content,
 * arranged as mono fields beside prose, using the full width and about a third
 * of the height. It is dense on purpose and it is not a degraded state — it is
 * what a row of a table of work should look like.
 *
 * Uploading a cover in the console switches that row to the spread with no
 * further change here, which is the point: the page is built for the images
 * that are coming without pretending they have already arrived.
 */
export function CaseRow({
  project,
  flip,
  priority,
}: {
  project: Project;
  flip?: boolean;
  /** True for the first row only — see ProjectMedia's `priority`. */
  priority?: boolean;
}) {
  const period = formatPeriod(project.started_on, project.ended_on);

  if (!project.image_url) {
    return (
      // A rule per row, so a run of these reads as a ledger of work rather than
      // as paragraphs drifting in a column. The rule is also what lets the
      // spacing between rows come down without them running together.
      <article className="group relative grid gap-x-10 gap-y-3 border-t border-border/60 pt-10 lg:grid-cols-[13rem_1fr] lg:pt-12">
        {/*
          The field column: what this row *is*, in the site's mono voice. The
          links live here too — down in the body they added a line of height to
          every row and left this column two lines tall against a five-line
          neighbour. Below `lg` the whole column stacks above the title, where
          it reads as the eyebrow it already looks like.
        */}
        <div className="lg:pt-1">
          <Eyebrow>/{project.slug}</Eyebrow>
          {period ? <Eyebrow className="mt-1.5">{period}</Eyebrow> : null}
          <ProjectLinks project={project} className="mt-3 flex-wrap gap-x-5 gap-y-0" />
        </div>

        <div>
          <ProjectTitle project={project} />
          {/* 3xl rather than 2xl: with the media panel gone this column is the
              full width of the layout, and a 2xl measure left a third of the
              row empty. */}
          <p className="mt-3 max-w-3xl text-muted-foreground">{project.description}</p>
          <TechChips technologies={project.technologies} className="mt-4" />
        </div>
      </article>
    );
  }

  return (
    <article className="group relative grid items-center gap-8 pt-14 first:pt-0 lg:grid-cols-2 lg:gap-14 lg:pt-20">
      {/* Shared-element morph: this panel and the detail page's header carry
          the same transition name, so clicking through animates the panel
          into the header instead of cutting. */}
      <ViewTransition name={`project-media-${project.slug}`}>
        <ProjectMedia
          slug={project.slug}
          title={project.title}
          imageUrl={project.image_url}
          cover
          priority={priority}
          className={cn(
            "aspect-video w-full transition-transform duration-500 group-hover:scale-[1.01]",
            flip && "lg:order-2",
          )}
        />
      </ViewTransition>

      <div>
        <Eyebrow>/{project.slug}</Eyebrow>
        <div className="mt-3">
          <ProjectTitle project={project} />
        </div>
        {period ? <Eyebrow className="mt-2">{period}</Eyebrow> : null}
        <p className="mt-4 max-w-xl text-muted-foreground">{project.description}</p>
        <TechChips technologies={project.technologies} className="mt-5" />
        <ProjectLinks project={project} className="mt-4" />
      </div>
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
            className="after:absolute after:inset-0 group-hover:text-primary"
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
