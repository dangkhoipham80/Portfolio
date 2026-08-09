import { ProjectCard } from "@/components/project-card";
import { EmptyState, Section } from "@/components/section";
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
      <section className="mx-auto max-w-5xl px-5 pt-20 pb-6">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Phạm Đăng Khôi
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Software engineering student at FPT University, focused on backend
          development — Python, FastAPI, Spring Boot — and moving toward data and
          AI engineering.
        </p>
      </section>

      <Section
        id="projects"
        title="Projects"
        description="Things I have built."
      >
        {projects.length === 0 ? (
          <EmptyState>No projects published yet.</EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </Section>

      <Section id="skills" title="Skills">
        {skills.length === 0 ? (
          <EmptyState>No skills published yet.</EmptyState>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            {groupByCategory(skills).map(([category, entries]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </h3>
                <ul className="mt-3 space-y-3">
                  {entries.map((skill) => (
                    <li key={skill.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm text-foreground">{skill.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {levelLabel(skill.level)}
                        </span>
                      </div>
                      <div
                        className="mt-1 h-1.5 overflow-hidden rounded-full bg-accent"
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
    </>
  );
}
