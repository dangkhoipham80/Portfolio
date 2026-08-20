import Link from "next/link";

import { CaseRow, ProjectIndexRow } from "@/components/case-row";
import { ContactSection } from "@/components/contact-section";
import { HeroTopology } from "@/components/hero-topology";
import { EmptyState, Section } from "@/components/section";
import { StackDiagram } from "@/components/stack-diagram";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getPosts, getSkills, readProjects } from "@/lib/api";
import { isoDay } from "@/lib/format";
import type { Skill } from "@/lib/types";

/** Preserve the order the API sends; it is the owner's chosen ordering. */
function groupByCategory(skills: Skill[]): [string, Skill[]][] {
  const groups = new Map<string, Skill[]>();

  for (const skill of skills) {
    const bucket = groups.get(skill.category);
    if (bucket) {
      bucket.push(skill);
    } else {
      groups.set(skill.category, [skill]);
    }
  }

  return [...groups.entries()];
}

/** How many recent posts the home page previews before pointing at /blog. */
const WRITING_PREVIEW_COUNT = 3;

export default async function HomePage() {
  // All three reads are independent, so let them overlap rather than waterfall.
  // The projects read keeps its outcome as well as its data: the hero's
  // topology lights the API node from it, so an empty list caused by an outage
  // and one caused by an empty database do not look the same.
  const [projectsRead, skills, posts] = await Promise.all([
    readProjects(),
    getSkills(),
    getPosts(),
  ]);

  const projects = projectsRead.data;

  // The owner curates `featured` in the console; featured work gets the
  // case-row treatment, the rest a compact index. If nothing is flagged the
  // whole list is the index — a site with no opinion beats an empty spread.
  const featured = projects.filter((p) => p.featured);
  const rest = projects.filter((p) => !p.featured);
  const recentPosts = posts.slice(0, WRITING_PREVIEW_COUNT);

  return (
    <>
      {/*
        The hero owns the first viewport. The name is the logo, set at display
        scale in one ink, and the topology sits beside the thesis as supporting
        evidence rather than competing with the name for the top row.

        The `hero-name-accent` spans below currently render no differently from
        the rest of the name — see the note on that class in globals.css. They
        are left in place because the diacritics are still the right thing to
        single out; what they need is a treatment that is not colour.
      */}
      <section className="relative flex min-h-[calc(100svh-4.25rem)] items-center py-20 sm:py-24">
        <Container width="layout">
          <Eyebrow className="hero-item">Backend · Data · AI</Eyebrow>
          {/*
            Leading opens up until the name fits on one line. Vietnamese
            stacks diacritics both ways — the nặng dot under "ạ" and the
            breve over "ă" — so at 1.04 a wrapped name has the dot of one
            line landing in the breve of the next. It only shows below `lg`,
            where the name wraps, which is exactly where it must not.
          */}
          <h1 className="hero-item mt-5 font-display text-[clamp(3.25rem,9vw,7.5rem)] font-extrabold leading-[1.16] tracking-[-0.03em] text-foreground lg:leading-[1.04] [animation-delay:80ms]">
            Ph<span className="hero-name-accent">ạ</span>m{" "}
            <span className="hero-name-accent">Đă</span>ng Kh
            <span className="hero-name-accent">ô</span>i
          </h1>

          <div className="mt-8 grid items-center gap-10 lg:mt-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="hero-item max-w-xl text-lg text-muted-foreground sm:text-xl [animation-delay:180ms]">
                I build the parts you do not see: APIs, schemas, queues and the
                services between them. Software engineering student at FPT
                University, working in Python and Java, moving toward data and
                AI engineering.
              </p>
              {/*
                A status line, in the same dot-plus-mono shape the career
                timeline uses: the one fact a recruiter scans for, styled as a
                health check rather than a banner.
              */}
              <p className="hero-item mt-8 flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.18em] text-primary [animation-delay:280ms]">
                {/* Lit, with a halo: this is a live status, which is exactly
                    what the hue is reserved for. */}
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-live shadow-[0_0_0_3px_hsl(var(--live)/0.18)]"
                />
                Open to mid-level+ roles
              </p>

              <div className="hero-item mt-10 flex flex-wrap gap-3 [animation-delay:360ms]">
                <Link href="/#projects" className={buttonClasses("primary")}>
                  View work
                </Link>
                <Link href="/blog" className={buttonClasses("quiet")}>
                  Read writing
                </Link>
              </div>
            </div>

            <HeroTopology
              projectCount={projects.length}
              apiOk={projectsRead.ok}
              className="hero-item w-full max-w-xl justify-self-center [animation-delay:440ms] lg:justify-self-end"
            />
          </div>
        </Container>
      </section>

      <Section
        id="projects"
        width="layout"
        eyebrow={`/selected-work · ${projects.length}`}
        title="Selected work"
      >
        {projects.length === 0 ? (
          <EmptyState>No entries returned — the write-up queue is still draining.</EmptyState>
        ) : (
          <>
            {/* No gap: each row carries its own top spacing, because a record
                row separates itself with a rule and a spread needs more air
                than a rule. */}
            <div className="flex flex-col">
              {(featured.length > 0 ? featured : projects).map((project, i) => (
                <CaseRow
                  key={project.id}
                  project={project}
                  flip={i % 2 === 1}
                  priority={i === 0}
                />
              ))}
            </div>

            {featured.length > 0 && rest.length > 0 ? (
              <div className="mt-20 lg:mt-24">
                <Eyebrow as="h3">/more-builds · {rest.length}</Eyebrow>
                <div className="mt-4 divide-y divide-border/60 border-t border-border/60">
                  {rest.map((project) => (
                    <ProjectIndexRow key={project.id} project={project} />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </Section>

      <Section
        id="skills"
        tinted
        width="layout"
        eyebrow={`/capabilities · ${skills.length}`}
        title="Where in the stack I work"
      >
        {skills.length === 0 ? (
          <EmptyState>No capabilities published yet.</EmptyState>
        ) : (
          <StackDiagram groups={groupByCategory(skills)} />
        )}
      </Section>

      {/*
        Absent, not empty.

        This section used to render "Nothing published yet — drafts are still in
        review." into 545px of otherwise blank page. An empty state earns its
        space when the reader can act on it or when the emptiness is itself
        information; here it is neither — it is a section announcing that it has
        nothing to say, on the one page whose job is to be convincing in five
        seconds. /blog is still in the nav and still has its own empty state for
        anyone who goes looking.
      */}
      {recentPosts.length > 0 ? (
        <Section
          id="writing"
          width="layout"
          eyebrow={`/writing · ${posts.length}`}
          title="Notes from the build"
        >
          <ul className="reveal-row divide-y divide-border/60 border-t border-border/60">
            {recentPosts.map((post) => (
              <li key={post.id}>
                <article className="group relative grid gap-1 py-6 sm:grid-cols-[8.5rem_1fr] sm:gap-6">
                  <time
                    dateTime={isoDay(post.published_at) ?? undefined}
                    className="pt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    {isoDay(post.published_at)}
                  </time>
                  <div>
                    <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="after:absolute after:inset-0 group-hover:text-primary"
                      >
                        {post.title}
                      </Link>
                    </h3>
                    {post.excerpt ? (
                      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                        {post.excerpt}
                      </p>
                    ) : null}
                  </div>
                </article>
              </li>
            ))}
          </ul>

          <Link
            href="/blog"
            className="mt-8 inline-flex min-h-11 items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-primary transition-colors hover:text-foreground"
          >
            All posts <span aria-hidden="true">→</span>
          </Link>
        </Section>
      ) : null}

      <ContactSection />
    </>
  );
}
