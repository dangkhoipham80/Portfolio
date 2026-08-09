import Link from "next/link";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ExternalLink } from "@/components/ui/external-link";
import { ProjectMedia } from "@/components/ui/project-media";
import { cn } from "@/lib/cn";
import { formatPeriod } from "@/lib/format";
import type { Project, ProjectStatus } from "@/lib/types";

/** Beyond this the tag row wraps to three lines and swamps the card. */
const VISIBLE_TAGS = 5;

/*
 * The card's top edge in the status colour — the same signal the StatusBadge
 * carries, in a second position, the way a CI pipeline paints a build row.
 * With no project images this is what makes a text-only card read as designed
 * rather than as a card whose image failed to load. Spelled out per status
 * because Tailwind scans source for complete class names.
 */
const STATUS_BORDER: Record<ProjectStatus, string> = {
  completed: "border-t-green-700 dark:border-t-green-400",
  in_progress: "border-t-blue-700 dark:border-t-blue-400",
  on_hold: "border-t-yellow-700 dark:border-t-yellow-400",
  dropped: "border-t-red-700 dark:border-t-red-400",
};

export function ProjectCard({ project }: { project: Project }) {
  const period = formatPeriod(project.started_on, project.ended_on);
  const shown = project.technologies.slice(0, VISIBLE_TAGS);
  const overflow = project.technologies.length - shown.length;

  return (
    <Card interactive className={cn("gap-4 border-t-2", STATUS_BORDER[project.status])}>
      <ProjectMedia
        slug={project.slug}
        title={project.title}
        imageUrl={project.image_url}
      />

      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {/*
            The whole card is the target, not just these few words. The
            ::after stretches this anchor over the card so the hit area matches
            what `interactive` makes look clickable, while the link text stays
            the title for anyone reading a list of links.
          */}
          <Link
            href={`/projects/${project.slug}`}
            className="after:absolute after:inset-0 hover:text-primary"
          >
            {project.title}
          </Link>
        </h3>
        <StatusBadge status={project.status} />
      </div>

      {period ? <Eyebrow>{period}</Eyebrow> : null}

      <p className="flex-1 text-sm text-muted-foreground">{project.description}</p>

      {shown.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((tech) => (
            <li key={tech}>
              <Badge>{tech}</Badge>
            </li>
          ))}
          {overflow > 0 ? (
            <li>
              <Badge variant="outline">+{overflow}</Badge>
            </li>
          ) : null}
        </ul>
      ) : null}

      {project.github_url || project.live_url ? (
        // Sits above the stretched link so these stay independently clickable.
        <div className="relative z-10 flex gap-4 border-t border-border/60 pt-4">
          {project.github_url ? (
            <ExternalLink href={project.github_url}>Source</ExternalLink>
          ) : null}
          {project.live_url ? (
            <ExternalLink href={project.live_url}>Live</ExternalLink>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
