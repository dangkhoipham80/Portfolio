import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { CareerTimeline } from "@/components/career-timeline";
import { CertificateLedger } from "@/components/certificate-ledger";
import { ChannelList } from "@/components/channel-list";
import { ContactForm } from "@/components/contact-form";
import { EmptyState } from "@/components/section";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ExternalLink } from "@/components/ui/external-link";
import { ProjectMedia } from "@/components/ui/project-media";
import { cn } from "@/lib/cn";
import { formatPeriod, isoDay, levelLabel } from "@/lib/format";
import type { CareerEntry, Certificate, Post, Project, Skill, SkillLevel } from "@/lib/types";

/*
 * What each place holds: the site's sections, written once as server
 * components and rendered in two frames — the panel that opens when the
 * player arrives, and the atlas that lists them for everyone else. No
 * `"use client"` here and no hooks; the contact form is the one client
 * component inside, for the reasons in its own file.
 *
 * Every panel opens with the same header — a mono path with a count, then
 * the section's name as an h2 — because the page's h1 is the owner's name
 * and a panel is a section of that page whichever frame it is in.
 */

function PanelHeader({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={`${id}-title`} className="mt-2 font-display text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">
        {title}
      </h2>
      {description ? <p className="mt-3 max-w-[var(--measure)] text-muted-foreground">{description}</p> : null}
    </header>
  );
}

/** A mono, tracked link at the foot of a panel: where the rest of it is. */
function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-8 inline-flex min-h-11 items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-primary transition-colors hover:text-foreground"
    >
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

/* ------------------------------------------------------------------------ */

export function AboutPanel({ counts }: { counts: { projects: number; posts: number } }) {
  return (
    <div>
      <PanelHeader id="about" eyebrow="/about · backend · data · ai" title="Hi, I'm Khôi." />
      <p className="mt-6 font-display text-xl font-medium leading-[1.4] tracking-[-0.02em] text-foreground sm:text-2xl">
        I build the parts you do not see: APIs, schemas, queues and the services
        between them.
      </p>
      <p className="mt-4 max-w-[var(--measure)] text-muted-foreground">
        Software engineering student at FPT University, working in Python and
        Java, moving toward data and AI engineering. This site is one of the
        builds: a FastAPI content service behind a Next.js front, and the
        island you are standing on is read from it.
      </p>
      <p className="mt-5 flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.18em] text-foreground">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-live shadow-[0_0_0_3px_hsl(var(--live)/0.18)]" />
        Open to mid-level+ roles
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a href="#projects" className={buttonClasses("primary")}>
          See the work{counts.projects > 0 ? ` · ${counts.projects}` : ""}
        </a>
        {counts.posts > 0 ? (
          <a href="#writing" className={buttonClasses("quiet")}>
            Read the notes · {counts.posts}
          </a>
        ) : null}
        <a href="#contact" className={buttonClasses("quiet")}>
          Get in touch
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * The work. Featured projects first, each with its cover; the rest as an
 * index. A project on this list is its title, its one-liner and its status
 * — the detail page has the stack and the story.
 */
export function ProjectsPanel({ projects }: { projects: Project[] }) {
  const featured = projects.filter((p) => p.featured);
  const rest = projects.filter((p) => !p.featured);
  const lead = featured.length > 0 ? featured : projects;
  const index = featured.length > 0 ? rest : [];

  return (
    <div>
      <PanelHeader
        id="projects"
        eyebrow={`/selected-work · ${projects.length}`}
        title="Selected work"
        description={projects.length > 0 ? "What I have built, most recent first. Each opens as a case: what it does, what broke, what I would change." : undefined}
      />
      {projects.length === 0 ? (
        <div className="mt-8">
          <EmptyState>No entries returned — the write-up queue is still draining.</EmptyState>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-border/60 border-t border-border/60">
            {lead.map((project, i) => (
              <li key={project.id}>
                <article
                  className={cn(
                    "group relative grid gap-4 py-6 sm:gap-6",
                    project.image_url && "sm:grid-cols-[minmax(0,1fr)_11rem]",
                  )}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h3 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                        <Link href={`/projects/${project.slug}`} className="link-draw after:absolute after:inset-0">
                          {project.title}
                        </Link>
                      </h3>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="mt-2 max-w-[var(--measure)] text-sm text-muted-foreground sm:text-base">
                      {project.description}
                    </p>
                    <p className="mt-3 font-mono text-xs text-muted-foreground">
                      {formatPeriod(project.started_on, project.ended_on)}
                      {project.technologies.length > 0 ? ` · ${project.technologies.slice(0, 4).join(" · ")}` : ""}
                    </p>
                    {project.github_url || project.live_url ? (
                      <div className="relative z-10 mt-1 flex gap-5">
                        {project.github_url ? <ExternalLink href={project.github_url}>Source</ExternalLink> : null}
                        {project.live_url ? <ExternalLink href={project.live_url}>Live</ExternalLink> : null}
                      </div>
                    ) : null}
                  </div>
                  <ProjectMedia
                    slug={project.slug}
                    title={project.title}
                    imageUrl={project.image_url}
                    priority={i === 0}
                    className="aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] border border-border/60"
                  />
                </article>
              </li>
            ))}
          </ul>
          {index.length > 0 ? (
            <div className="mt-8">
              <Eyebrow as="h3">/more-builds · {index.length}</Eyebrow>
              <ul className="mt-3 divide-y divide-border/60 border-t border-border/60">
                {index.map((project) => (
                  <li key={project.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                    <Link href={`/projects/${project.slug}`} className="link-draw min-h-11 py-2 font-medium text-foreground">
                      {project.title}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatPeriod(project.started_on, project.ended_on)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/*
 * Depth as temperature. The site's two lights are a request going out (cool)
 * and a response coming back (warm), and the stack borrows the scale: the
 * deeper the proficiency, the warmer the chip. Expert is lit warm, advanced
 * lit cool, intermediate is an unlit surface and beginner is an outline. The
 * text stays ink at every step — colour is on the fill, never the word.
 * Spelled out per level because Tailwind scans source for complete classes.
 */
const LEVEL_CHIP: Record<SkillLevel, string> = {
  expert: "border-sig-warm/60 bg-sig-warm/15 text-foreground font-medium",
  advanced: "border-sig-cool/50 bg-sig-cool/12 text-foreground",
  intermediate: "border-transparent bg-muted text-foreground",
  beginner: "border-border bg-transparent text-muted-foreground",
};

const LEGEND: SkillLevel[] = ["expert", "advanced", "intermediate", "beginner"];

/** Preserve the order the API sends; it is the owner's chosen ordering. */
export function groupByCategory(skills: Skill[]): [string, Skill[]][] {
  const groups = new Map<string, Skill[]>();
  for (const skill of skills) {
    const bucket = groups.get(skill.category);
    if (bucket) bucket.push(skill);
    else groups.set(skill.category, [skill]);
  }
  return [...groups.entries()];
}

/**
 * The stack, one layer per category, the way the cairn stacks them: a
 * request descends through the layers top to bottom, so the list reads
 * in that order. Proficiency is on the chip's fill, never a bar.
 */
export function SkillsPanel({ skills }: { skills: Skill[] }) {
  const groups = groupByCategory(skills);
  return (
    <div>
      <PanelHeader
        id="skills"
        eyebrow={`/capabilities · ${skills.length}`}
        title="Where in the stack I work"
        description={skills.length > 0 ? "One layer per stone on the cairn. Depth is on the fill: the warmer the chip, the deeper I have gone." : undefined}
      />
      {skills.length === 0 ? (
        <div className="mt-8">
          <EmptyState>No capabilities published yet.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-8 border-t border-border/60">
            {groups.map(([category, entries]) => (
              <section key={category} className="grid gap-3 border-b border-border/60 py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
                <h3 className="font-display text-lg font-bold tracking-tight text-foreground">{category}</h3>
                <ul className="stagger flex flex-wrap gap-2">
                  {entries.map((skill, i) => (
                    <li
                      key={skill.id}
                      title={levelLabel(skill.level)}
                      style={{ "--i": i } as CSSProperties}
                      className={cn(
                        "inline-flex items-center rounded-[var(--radius-control)] border px-3 py-1.5 font-mono text-xs",
                        LEVEL_CHIP[skill.level],
                      )}
                    >
                      {skill.name}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {/* The encoding, stated rather than assumed. */}
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Depth:</span>
            {LEGEND.map((level) => (
              <span
                key={level}
                className={cn("inline-flex items-center rounded-[var(--radius-control)] border px-2 py-0.5", LEVEL_CHIP[level])}
              >
                {levelLabel(level)}
              </span>
            ))}
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** How many recent posts the tree shows before pointing at /blog. */
const WRITING_PREVIEW_COUNT = 5;

export function WritingPanel({ posts }: { posts: Post[] }) {
  const recent = posts.slice(0, WRITING_PREVIEW_COUNT);
  return (
    <div>
      <PanelHeader
        id="writing"
        eyebrow={`/writing · ${posts.length}`}
        title="Notes from the build"
        description={posts.length > 0 ? "What I built, what broke, and what the fix turned out to be. Mostly backend, occasionally CSS." : undefined}
      />
      {posts.length === 0 ? (
        <div className="mt-8">
          <EmptyState>The shelves are bare for now — drafts are still in review.</EmptyState>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-border/60 border-t border-border/60">
            {recent.map((post) => (
              <li key={post.id}>
                <article className="group relative grid gap-1 py-5 sm:grid-cols-[7.5rem_1fr] sm:gap-5">
                  <time
                    dateTime={isoDay(post.published_at) ?? undefined}
                    className="pt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    {isoDay(post.published_at)}
                  </time>
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                      <Link href={`/blog/${post.slug}`} className="link-draw after:absolute after:inset-0">
                        {post.title}
                      </Link>
                    </h3>
                    {post.excerpt ? (
                      <p className="mt-1.5 max-w-[var(--measure)] text-sm text-muted-foreground">{post.excerpt}</p>
                    ) : null}
                  </div>
                </article>
              </li>
            ))}
          </ul>
          <MoreLink href="/blog">All {posts.length} posts</MoreLink>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

export function CareerPanel({ entries }: { entries: CareerEntry[] }) {
  return (
    <div>
      <PanelHeader id="career" eyebrow={`/career · ${entries.length}`} title="Where I have worked and studied" />
      <div className="mt-8">
        {entries.length === 0 ? (
          <EmptyState>No career entries published yet.</EmptyState>
        ) : (
          <CareerTimeline entries={entries} level="h3" />
        )}
      </div>
    </div>
  );
}

export function CertificatesPanel({ certificates }: { certificates: Certificate[] }) {
  return (
    <div>
      <PanelHeader id="certificates" eyebrow={`/credentials · ${certificates.length}`} title="Courses and certifications" />
      <div className="mt-8">
        {certificates.length === 0 ? (
          <EmptyState>No certificates published yet.</EmptyState>
        ) : (
          <CertificateLedger certificates={certificates} level="h3" />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * The cabin: the channels above the form, not tucked into an error state,
 * because they work when the API is asleep and the form does not.
 */
export function ContactPanel() {
  return (
    <div>
      <PanelHeader
        id="contact"
        eyebrow="/contact"
        title="Send me a message"
        description="Open to mid-level roles and above in backend, data and AI engineering. Anything that lands here reaches my inbox."
      />
      <div className="mt-8">
        <ChannelList />
      </div>
      <div className="mt-8 max-w-2xl">
        <ContactForm />
      </div>
    </div>
  );
}
