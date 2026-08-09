import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { STATUS_CLASSES, formatPeriod, statusLabel } from "@/lib/format";
import { getProject, getProjects } from "@/lib/api";

/**
 * Pre-render the published projects at build time. Anything else — including a
 * project published after the last deploy — still renders on demand and is then
 * cached, so a new entry does not need a redeploy to become reachable.
 */
export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) return { title: "Project not found" };

  return {
    title: project.title,
    description: project.description,
  };
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-foreground">
            <span aria-hidden="true" className="text-primary">
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = await getProject(slug);

  // getProject returns null both for a genuine 404 and for an API outage. A
  // visitor can do nothing about either, and 404 is the honest answer for "this
  // page has no content" — the outage is distinguishable on the server log.
  if (!project) notFound();

  const period = formatPeriod(project.started_on, project.ended_on);

  return (
    <article className="mx-auto max-w-3xl px-5 py-14">
      <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
        ← Back
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {project.title}
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              STATUS_CLASSES[project.status]
            }`}
          >
            {statusLabel(project.status)}
          </span>
        </div>
        {period ? <p className="mt-2 text-sm text-muted-foreground">{period}</p> : null}
      </header>

      <p className="mt-6 text-foreground">{project.description}</p>

      {project.long_description ? (
        <p className="mt-4 whitespace-pre-line text-muted-foreground">
          {project.long_description}
        </p>
      ) : null}

      {project.technologies.length > 0 ? (
        <ul className="mt-6 flex flex-wrap gap-1.5">
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

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <DetailList title="Features" items={project.features} />
        <DetailList title="Challenges" items={project.challenges} />
      </div>

      {project.github_url || project.live_url ? (
        <div className="mt-10 flex gap-4 border-t border-border pt-6 text-sm">
          {project.github_url ? (
            <a
              href={project.github_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary hover:underline"
            >
              View source
            </a>
          ) : null}
          {project.live_url ? (
            <a
              href={project.live_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary hover:underline"
            >
              Visit site
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
