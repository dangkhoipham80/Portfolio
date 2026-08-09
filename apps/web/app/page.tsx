import { ContactSection } from "@/components/contact-section";
import { HeroTopology } from "@/components/hero-topology";
import { ProjectCard } from "@/components/project-card";
import { EmptyState, Section } from "@/components/section";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getProjects, getSkills } from "@/lib/api";
import { LEVEL_WIDTH, levelLabel } from "@/lib/format";
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

export default async function HomePage() {
  // Both reads are independent, so let them overlap rather than waterfall.
  const [projects, skills] = await Promise.all([getProjects(), getSkills()]);

  return (
    <>
      <section className="py-20 sm:py-28 lg:py-36">
        {/*
          Two columns at lg, not md: at exactly 768px the h1 wraps against a
          half-width diagram and both look cramped. Stacked-until-1024 gives
          each its full measure instead.
        */}
        <Container width="layout" className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Eyebrow>Backend · Data · AI</Eyebrow>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Phạm Đăng Khôi
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              I build the parts you do not see: APIs, schemas, queues and the
              services between them. Software engineering student at FPT
              University, working in Python and Java, moving toward data and AI
              engineering.
            </p>
            {/*
              A status line, in the same dot-plus-mono shape the career timeline
              uses: the one fact a recruiter scans for, styled as a health check
              rather than a banner.
            */}
            <p className="mt-8 flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.18em] text-primary">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
              Open to mid-level+ roles
            </p>
          </div>

          <HeroTopology className="justify-self-center lg:justify-self-stretch" />
        </Container>
      </section>

      <Section
        id="projects"
        width="layout"
        eyebrow={`Projects · ${projects.length}`}
        title="Things I have built"
      >
        {projects.length === 0 ? (
          <EmptyState>No projects published yet.</EmptyState>
        ) : (
          /*
            Three columns at lg keeps text-only cards at a readable width in the
            layout container. In the two-column range a dangling odd card spans
            the row — half-filled last rows read as missing data, not layout.
          */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:max-lg:[&>*:nth-child(odd):last-child]:col-span-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </Section>

      <Section
        id="skills"
        tinted
        width="layout"
        eyebrow={`Skills · ${skills.length}`}
        title="What I work with"
      >
        {skills.length === 0 ? (
          <EmptyState>No skills published yet.</EmptyState>
        ) : (
          <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {groupByCategory(skills).map(([category, entries]) => (
              <div key={category}>
                <Eyebrow>{category}</Eyebrow>
                <ul className="mt-4 space-y-3.5">
                  {entries.map((skill) => (
                    <li key={skill.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-foreground">{skill.name}</span>
                        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          {levelLabel(skill.level)}
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-1 overflow-hidden rounded-full bg-accent"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: LEVEL_WIDTH[skill.level] }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      <ContactSection />
    </>
  );
}
