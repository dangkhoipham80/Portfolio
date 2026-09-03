import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge, chipClasses } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { ProjectGallery } from "@/components/project-gallery";
import { Eyebrow, eyebrowClasses } from "@/components/ui/eyebrow";
import { ExternalLink } from "@/components/ui/external-link";
import { ProjectMedia } from "@/components/ui/project-media";
import { cn } from "@/lib/cn";
import { formatPeriod } from "@/lib/format";
import { getProject, getProjects } from "@/lib/api";
import { ViewTransition } from "@/lib/view-transition";

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

/** Features/Challenges as a prose section rather than twin bullet columns. */
function DetailList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <Eyebrow as="h2">{title}</Eyebrow>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-foreground">
            <span
              aria-hidden="true"
              className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-signal"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  // The list read is what the prev/next footer needs; the single read stays
  // because an unpublished-then-published project may not be in the cached
  // list yet. Both fall back independently.
  const [project, projects] = await Promise.all([getProject(slug), getProjects()]);

  // getProject returns null both for a genuine 404 and for an API outage. A
  // visitor can do nothing about either, and 404 is the honest answer for "this
  // page has no content" — the outage is distinguishable on the server log.
  if (!project) notFound();

  const period = formatPeriod(project.started_on, project.ended_on);

  // Neighbours in the owner's chosen ordering, for the keep-moving footer.
  const at = projects.findIndex((p) => p.slug === project.slug);
  const previous = at > 0 ? projects[at - 1] : null;
  const next = at >= 0 && at < projects.length - 1 ? projects[at + 1] : null;

  return (
    <article className="py-14 sm:py-20">
      <Container width="layout">
        <Link
          href="/#projects"
          className={cn(eyebrowClasses, "transition-colors hover:text-primary")}
        >
          ← All projects
        </Link>

        <header className="mt-8">
          <Eyebrow>/{project.slug}</Eyebrow>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {project.title}
            </h1>
            <StatusBadge status={project.status} />
          </div>
        </header>

        {/* Same transition name as the home page's case row: the panel a
            visitor clicked morphs into this header. */}
        <ViewTransition name={`project-media-${project.slug}`}>
          <ProjectMedia
            slug={project.slug}
            title={project.title}
            imageUrl={project.image_url}
            technologies={project.technologies}
            cover
            // A fixed height, not an aspect ratio: 21/9 of the layout container
            // is most of a viewport of empty panel. This is a header, not the
            // content.
            className="mt-10 !aspect-auto h-56 sm:h-72 lg:h-80"
          />
        </ViewTransition>

        {/*
          The case-study split: a sticky rail of the project's fields beside
          the reading column. The rail is the mono metadata a recruiter scans
          for — stack, dates, links — pinned so it stays answerable while the
          prose scrolls.
        */}
        <div className="mt-12 grid gap-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-1">
              {period ? (
                <div>
                  <dt className={eyebrowClasses}>Period</dt>
                  <dd className="mt-1.5 text-sm text-foreground">{period}</dd>
                </div>
              ) : null}

              {project.technologies.length > 0 ? (
                <div className="col-span-2 lg:col-span-1">
                  <dt className={eyebrowClasses}>Stack</dt>
                  <dd className="mt-2">
                    <ul className="flex flex-wrap gap-1.5">
                      {project.technologies.map((tech) => (
                        <li key={tech} className={chipClasses}>
                          {tech}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}

              {project.github_url || project.live_url || project.links.length > 0 ? (
                <div>
                  <dt className={eyebrowClasses}>Links</dt>
                  <dd className="mt-1 flex flex-col items-start">
                    {project.github_url ? (
                      <ExternalLink href={project.github_url}>View source</ExternalLink>
                    ) : null}
                    {project.live_url ? (
                      <ExternalLink href={project.live_url}>Visit site</ExternalLink>
                    ) : null}
                    {/*
                      After the two fixed ones, in the order they were entered.
                      Source and live keep their positions and their wording
                      because they are the two a recruiter looks for by name;
                      the rest are whatever this particular project has.
                    */}
                    {project.links.map((link) => (
                      <ExternalLink key={link.url} href={link.url}>
                        {link.label}
                      </ExternalLink>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>

          <div className="max-w-2xl">
            <p className="text-lg text-foreground sm:text-xl">{project.description}</p>

            {project.long_description ? (
              <p className="mt-6 whitespace-pre-line text-muted-foreground">
                {project.long_description}
              </p>
            ) : null}

            <DetailList title="Features" items={project.features} />
            <DetailList title="Challenges" items={project.challenges} />

            <ProjectGallery images={project.gallery} title={project.title} />
          </div>
        </div>

        {/*
          Keep the reader moving: a case study that dead-ends sends a recruiter
          back to the tab bar. Previous/next in the owner's own ordering.
        */}
        {previous || next ? (
          <nav
            aria-label="More projects"
            className="mt-16 grid gap-4 border-t border-border/60 pt-8 sm:grid-cols-2"
          >
            {previous ? (
              <Link
                href={`/projects/${previous.slug}`}
                className="group rounded-[var(--radius-card)] p-2 -m-2"
              >
                <span className={eyebrowClasses}>← Previous</span>
                <span className="mt-1 block font-display text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                  {previous.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/projects/${next.slug}`}
                className="group rounded-[var(--radius-card)] p-2 -m-2 sm:text-right"
              >
                <span className={eyebrowClasses}>Next →</span>
                <span className="mt-1 block font-display text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                  {next.title}
                </span>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </Container>
    </article>
  );
}
