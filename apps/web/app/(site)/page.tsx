import Link from "next/link";

import { CaseRow, ProjectIndexRow } from "@/components/case-row";
import { ContactSection } from "@/components/contact-section";
import { HeroTopology } from "@/components/hero-topology";
import { EmptyState, Section } from "@/components/section";
import { StackDiagram } from "@/components/stack-diagram";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getPosts, getProjects, getSkills } from "@/lib/api";
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
  const [projects, skills, posts] = await Promise.all([
    getProjects(),
    getSkills(),
    getPosts(),
  ]);

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
        scale with its Vietnamese glyphs lit in signal amber — the identity in
        one line — and the topology sits beside the thesis as supporting
        evidence rather than competing with the name for the top row.
      */}
      <section className="hero-atmosphere relative flex min-h-[calc(100svh-4.25rem)] items-center py-20 sm:py-24">
        <Container width="layout">
          <Eyebrow className="hero-item">Backend · Data · AI</Eyebrow>
          <h1 className="hero-item mt-5 font-display text-[clamp(3.25rem,9vw,7.5rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-foreground [animation-delay:80ms]">
            Ph<span className="hero-name-accent">ạ</span>m{" "}
            <span className="hero-name-accent">Đă</span>ng Kh
            <span className="hero-name-accent">ô</span>i
          </h1>

          <div className="mt-10 grid items-center gap-12 lg:mt-14 lg:grid-cols-2">
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
                <span aria-hidden="true" className="status-dot h-1.5 w-1.5 rounded-full bg-signal" />
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

            <HeroTopology className="w-full max-w-xl justify-self-center lg:justify-self-end" />
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
            <div className="flex flex-col gap-20 lg:gap-28">
              {(featured.length > 0 ? featured : projects).map((project, i) => (
                <CaseRow key={project.id} project={project} flip={i % 2 === 1} />
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

      <Section
        id="writing"
        width="layout"
        eyebrow={`/writing · ${posts.length}`}
        title="Notes from the build"
      >
        {recentPosts.length === 0 ? (
          <EmptyState>Nothing published yet — drafts are still in review.</EmptyState>
        ) : (
          <>
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
          </>
        )}
      </Section>

      <ContactSection />
    </>
  );
}
