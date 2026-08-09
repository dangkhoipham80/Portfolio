import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ExternalLink } from "@/components/ui/external-link";
import { ProjectMedia } from "@/components/ui/project-media";
import { formatPeriod } from "@/lib/format";
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
      <Eyebrow>{title}</Eyebrow>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm text-foreground">
            <span
              aria-hidden="true"
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary"
            />
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
    <article className="py-14 sm:py-20">
      <Container width="reading">
        <Link
          href="/#projects"
          className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
        >
          ← All projects
        </Link>

        <header className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {project.title}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          {period ? <Eyebrow className="mt-3">{period}</Eyebrow> : null}
        </header>

        <ProjectMedia
          slug={project.slug}
          title={project.title}
          imageUrl={project.image_url}
          className="mt-8"
        />

        <p className="mt-8 text-lg text-foreground">{project.description}</p>

        {project.long_description ? (
          <p className="mt-5 whitespace-pre-line text-muted-foreground">
            {project.long_description}
          </p>
        ) : null}

        {project.technologies.length > 0 ? (
          <>
            <Eyebrow className="mt-10">Stack</Eyebrow>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {project.technologies.map((tech) => (
                <li key={tech}>
                  <Badge>{tech}</Badge>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <DetailList title="Features" items={project.features} />
          <DetailList title="Challenges" items={project.challenges} />
        </div>

        {project.github_url || project.live_url ? (
          <div className="mt-12 flex gap-6 border-t border-border pt-6">
            {project.github_url ? (
              <ExternalLink href={project.github_url}>View source</ExternalLink>
            ) : null}
            {project.live_url ? (
              <ExternalLink href={project.live_url}>Visit site</ExternalLink>
            ) : null}
          </div>
        ) : null}
      </Container>
    </article>
  );
}
