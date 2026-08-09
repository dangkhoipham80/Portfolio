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
      <section className="py-16 sm:py-24">
        <Container className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
          <div>
            <Eyebrow>Backend · Data · AI</Eyebrow>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Phạm Đăng Khôi
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              I build the parts you do not see: APIs, schemas, queues and the
              services between them. Software engineering student at FPT
              University, working in Python and Java, moving toward data and AI
              engineering.
            </p>
          </div>

          <HeroTopology className="justify-self-center md:justify-self-end" />
        </Container>
      </section>

      <Section
        id="projects"
        eyebrow={`Projects · ${projects.length}`}
        title="Things I have built"
      >
        {projects.length === 0 ? (
          <EmptyState>No projects published yet.</EmptyState>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </Section>

      <Section id="skills" eyebrow={`Skills · ${skills.length}`} title="What I work with">
        {skills.length === 0 ? (
          <EmptyState>No skills published yet.</EmptyState>
        ) : (
          <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
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
