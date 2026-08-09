import Link from "next/link";

import { STATUS_CLASSES, formatPeriod, statusLabel } from "@/lib/format";
import type { Project } from "@/lib/types";

export function ProjectCard({ project }: { project: Project }) {
  const period = formatPeriod(project.started_on, project.ended_on);

  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-foreground">
          <Link href={`/projects/${project.slug}`} className="hover:text-primary">
            {project.title}
          </Link>
        </h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_CLASSES[project.status]
          }`}
        >
          {statusLabel(project.status)}
        </span>
      </div>

      {period ? <p className="mt-1 text-xs text-muted-foreground">{period}</p> : null}

      <p className="mt-3 flex-1 text-sm text-muted-foreground">{project.description}</p>

      {project.technologies.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {project.technologies.map((tech) => (
            <li
              key={tech}
              className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground"
            >
              {tech}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex gap-4 text-sm">
        <Link href={`/projects/${project.slug}`} className="text-primary hover:underline">
          Details
        </Link>
        {project.github_url ? (
          <a
            href={project.github_url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:text-primary"
          >
            Source
          </a>
        ) : null}
        {project.live_url ? (
          <a
            href={project.live_url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:text-primary"
          >
            Live
          </a>
        ) : null}
      </div>
    </article>
  );
}
