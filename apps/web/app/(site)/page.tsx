import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";
import type { WorldFacts } from "@/components/world/content";
import {
  AboutPanel,
  CareerPanel,
  CertificatesPanel,
  ContactPanel,
  groupByCategory,
  ProjectsPanel,
  SkillsPanel,
  WritingPanel,
} from "@/components/world/panels";
import { QUEST_ORDER, placeById, type PlaceId } from "@/components/world/places";
import { World } from "@/components/world/world";
import { getCareerEntries, getCertificates, getPosts, getSkills, readProjects } from "@/lib/api";

/**
 * The home page is the island.
 *
 * Everything the site has to say is read here, once, and handed to the world
 * twice: as facts — counts, the newest of each thing — for the people on
 * the island to talk about, and as panels, one per place, for the player to
 * open on arrival. The same panels are the atlas, the list every reader
 * without the scene gets. A section that used to be a band on this page is
 * now a building on it; nothing was dropped on the way.
 */
export default async function HomePage() {
  // All the reads are independent, so let them overlap rather than waterfall.
  // The projects read keeps its outcome as well as its data: the pond on
  // the island tells you whether the API answered, so an empty list caused
  // by an outage and one caused by an empty database do not look the same.
  const [projectsRead, skills, posts, career, certificates] = await Promise.all([
    readProjects(),
    getSkills(),
    getPosts(),
    getCareerEntries(),
    getCertificates(),
  ]);

  const projects = projectsRead.data;
  const current = career.find((entry) => entry.ended_on === null) ?? career[0] ?? null;

  const facts: WorldFacts = {
    projects: {
      count: projects.length,
      featured: projects.filter((p) => p.featured).length,
      latest: projects[0] ? { title: projects[0].title, slug: projects[0].slug } : null,
    },
    posts: {
      count: posts.length,
      latest: posts[0] ? { title: posts[0].title, slug: posts[0].slug } : null,
    },
    career: {
      count: career.length,
      current: current ? { title: current.title, company: current.company } : null,
    },
    certificates: {
      count: certificates.length,
      latestIssuer: certificates[0]?.issuer ?? null,
    },
    skills: {
      count: skills.length,
      categories: groupByCategory(skills).map(([category]) => category),
    },
    apiOk: projectsRead.ok,
  };

  const counts: Partial<Record<PlaceId, number>> = {
    projects: projects.length,
    skills: skills.length,
    writing: posts.length,
    career: career.length,
    certificates: certificates.length,
  };

  const panels: Record<PlaceId, ReactNode> = {
    about: <AboutPanel counts={{ projects: projects.length, posts: posts.length }} />,
    projects: <ProjectsPanel projects={projects} />,
    skills: <SkillsPanel skills={skills} />,
    writing: <WritingPanel posts={posts} />,
    career: <CareerPanel entries={career} />,
    certificates: <CertificatesPanel certificates={certificates} />,
    contact: <ContactPanel />,
  };

  // The atlas, in walking order. The writing section is absent rather than
  // empty when there are no posts: a list announcing it has nothing to say
  // earns no place on a page whose job is to be convincing in five seconds.
  // The tree still stands on the island, and its panel still explains.
  const atlasSections = QUEST_ORDER.filter((id) => !(id === "writing" && posts.length === 0)).map((id) => ({
    place: placeById(id),
    content: panels[id],
  }));

  return (
    <section className="relative flex min-h-[calc(100svh-4.25rem)] flex-col">
      <World
        facts={facts}
        counts={counts}
        panels={panels}
        atlasSections={atlasSections}
        className="min-h-[calc(100svh-4.25rem)] flex-1"
        nameplate={
          /*
            The nameplate: the page's h1, in the corner of the world rather
            than across the top of the page. The name is still the logo and
            still the first thing on the page; it is a signature over the
            island now, and the island is the argument. Handed to the world
            so it sits under the panels rather than over them.
          */
          <div className="hero-item">
            <Eyebrow>Backend · Data · AI</Eyebrow>
            <h1 className="mt-1 font-display text-2xl font-extrabold leading-none tracking-[-0.04em] text-foreground sm:text-3xl">
              Phạm Đăng Khôi
            </h1>
          </div>
        }
      />
    </section>
  );
}
