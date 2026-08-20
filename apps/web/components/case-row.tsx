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

/**
 * A featured project as a full-width case row: media beside the argument for
 * it, alternating sides so the section reads as a sequence of spreads rather
 * than a grid of tiles. The grid treats every project as the same size;
 * featured work is not the same size, and this is the layout saying so.
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

  return (
    <article
      className="group relative grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
    >
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
        {/* The project addressed the way the spine addresses everything:
            as a path. */}
        <Eyebrow>/{project.slug}</Eyebrow>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h3 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            <Link
              href={`/projects/${project.slug}`}
              // The whole row is the target; the ::after stretches this anchor
              // over it while the link text stays the title.
              className="after:absolute after:inset-0 hover:text-primary"
            >
              {project.title}
            </Link>
          </h3>
          <StatusBadge status={project.status} />
        </div>

        {period ? <Eyebrow className="mt-2">{period}</Eyebrow> : null}

        <p className="mt-4 max-w-xl text-muted-foreground">{project.description}</p>

        {project.technologies.length > 0 ? (
          <ul className="mt-5 flex flex-wrap items-center gap-1.5">
            {project.technologies.slice(0, CASE_ROW_CHIPS).map((tech) => (
              <li key={tech} className={chipClasses}>
                {tech}
              </li>
            ))}
            {project.technologies.length > CASE_ROW_CHIPS ? (
              <li className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                +{project.technologies.length - CASE_ROW_CHIPS}
              </li>
            ) : null}
          </ul>
        ) : null}

        {project.github_url || project.live_url ? (
          // Above the stretched link so these stay independently clickable.
          <div className="relative z-10 mt-4 flex gap-5">
            {project.github_url ? (
              <ExternalLink href={project.github_url}>Source</ExternalLink>
            ) : null}
            {project.live_url ? (
              <ExternalLink href={project.live_url}>Live</ExternalLink>
            ) : null}
          </div>
        ) : null}
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
