import Link from "next/link";
import type { CSSProperties } from "react";

import { CaseRow, ProjectIndexRow } from "@/components/case-row";
import { ContactSection } from "@/components/contact-section";
import { HeroWire } from "@/components/hero-wire";
import { PointerLight } from "@/components/pointer-light";
import { EmptyState, Section } from "@/components/section";
import { SkillTicker } from "@/components/skill-ticker";
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

/** The name, one slot per word so each can rise on its own. */
const NAME = ["Phạm", "Đăng", "Khôi"];

export default async function HomePage() {
  // All three reads are independent, so let them overlap rather than waterfall.
  // The projects read keeps its outcome as well as its data: the hero's wire
  // lights the API node from it, so an empty list caused by an outage and one
  // caused by an empty database do not look the same.
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
        The hero owns the first viewport, and it uses all of it.

        The name is the logo, set to run the width of the screen — the size
        is in `vw` so it does at every width, and each word rises out of a
        slot cut in the page as the site boots. Below it the request path
        that served this response runs edge to edge as one wire, which is the
        page's thesis and its signature in the same drawing. The light on the
        hero follows the pointer: the only thing on the page that answers to
        the reader directly.
      */}
      <section className="relative flex min-h-[calc(100svh-4.25rem)] flex-col justify-between overflow-hidden pb-10 pt-10 sm:pt-14 lg:pb-12">
        <PointerLight />

        <Container width="full" className="relative">
          <div className="hero-item flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <Eyebrow>Backend · Data · AI</Eyebrow>
            {/*
              A status line, in the same dot-plus-mono shape the career
              timeline uses: the one fact a recruiter scans for, styled as a
              health check rather than a banner. Lit, with a halo: this is a
              live status, which is exactly what the hue is reserved for.
            */}
            <p className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.18em] text-foreground">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-live shadow-[0_0_0_3px_hsl(var(--live)/0.18)]"
              />
              Open to mid-level+ roles
            </p>
          </div>

          {/*
            The name measures about 8.1em set in Be Vietnam Pro 800. It has
            come down twice: 11.9vw filled the gutters exactly, 8.4vw left the
            right third to the wire, and the owner's verdict on both was "too
            big". 6vw is the size that stops being a billboard — a signature
            at the top of the page, read in one glance rather than scanned
            across. The step down to the section headings below matters as
            much as the number: at 8.4vw the name was 121px and every h2 was
            101px, which is not a hierarchy, it is two billboards.

            At this size it holds one line everywhere from 360px up, so the
            tight `lg` leading is what a single line wants. The looser default
            is for the narrowest phones, where it does wrap: Vietnamese stacks
            diacritics both ways — the nặng dot under "ạ" and the circumflex
            over "ô" — so the lines need room exactly where they meet.
          */}
          <h1 className="hero-words mt-8 font-display text-[clamp(2.5rem,6vw,7.5rem)] font-extrabold leading-[1.08] tracking-[-0.04em] text-foreground sm:mt-10 lg:leading-[0.94]">
            {NAME.map((word, i) => (
              <span key={word}>
                <span className="mask-word" style={{ "--i": i } as CSSProperties}>
                  <span>{word}</span>
                </span>{" "}
              </span>
            ))}
          </h1>

          <div className="mt-10 grid items-end gap-8 sm:mt-12 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
            {/*
              Two tiers, not one grey paragraph. The claim is set in the
              display face at a reading size the name has just earned; the
              biography under it is body copy and muted, because it is the
              supporting fact, not the thesis.
            */}
            <div className="hero-item max-w-2xl [animation-delay:520ms]">
              {/*
                Leading opens up as the size comes down. At `lg` this is one
                32px display line and 1.25 is what a display line wants; at
                375px it is 24px and wraps to five, where the same ratio is
                body copy set too tight to track back across.
              */}
              <p className="font-display text-2xl font-medium leading-[1.4] tracking-[-0.02em] text-foreground sm:text-3xl sm:leading-[1.3] lg:text-[2rem] lg:leading-[1.3]">
                I build the parts you do not see: APIs, schemas, queues and the
                services between them.
              </p>
              <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                Software engineering student at FPT University, working in
                Python and Java, moving toward data and AI engineering.
              </p>
            </div>

            <div className="hero-item flex flex-wrap gap-3 lg:justify-end [animation-delay:640ms]">
              <Link href="/#projects" className={buttonClasses("primary")}>
                View work
              </Link>
              <Link href="/blog" className={buttonClasses("quiet")}>
                Read writing
              </Link>
            </div>
          </div>
        </Container>

        <HeroWire
          projectCount={projects.length}
          apiOk={projectsRead.ok}
          className="mt-14 sm:mt-20"
        />
      </section>

      <SkillTicker skills={skills} />

      <Section
        id="projects"
        width="full"
        flush
        eyebrow={`/selected-work · ${projects.length}`}
        title="Selected work"
      >
        {projects.length === 0 ? (
          <Container width="full">
            <EmptyState>No entries returned — the write-up queue is still draining.</EmptyState>
          </Container>
        ) : (
          <>
            <div className="flex flex-col">
              {(featured.length > 0 ? featured : projects).map((project, i) => (
                <CaseRow key={project.id} project={project} priority={i === 0} />
              ))}
            </div>

            {featured.length > 0 && rest.length > 0 ? (
              <Container width="full" className="mt-16 lg:mt-20">
                <Eyebrow as="h3">/more-builds · {rest.length}</Eyebrow>
                <div className="mt-4 divide-y divide-border/60 border-t border-border/60">
                  {rest.map((project) => (
                    <ProjectIndexRow key={project.id} project={project} />
                  ))}
                </div>
              </Container>
            ) : null}
          </>
        )}
      </Section>

      <Section
        id="skills"
        width="full"
        flush
        eyebrow={`/capabilities · ${skills.length}`}
        title="Where in the stack I work"
      >
        {skills.length === 0 ? (
          <Container width="full">
            <EmptyState>No capabilities published yet.</EmptyState>
          </Container>
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
          width="full"
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
                    <h3 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="link-draw after:absolute after:inset-0"
                      >
                        {post.title}
                      </Link>
                    </h3>
                    {post.excerpt ? (
                      <p className="mt-1.5 max-w-[var(--measure)] text-sm text-muted-foreground">
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
