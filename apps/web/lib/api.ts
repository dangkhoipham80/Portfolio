import "server-only";

import type { CareerEntry, Certificate, Post, Project, Skill } from "./types";

/**
 * Server-side reader for the content API.
 *
 * Runs in React Server Components only — hence `server-only`, which turns an
 * accidental client import into a build error rather than a runtime one where
 * `API_URL` is silently undefined. Fetching on the server also means the browser
 * never talks to the API directly, so CORS does not apply and the API's location
 * is not published to visitors.
 *
 * Every reader takes a fallback and returns it on failure. That is deliberate:
 * this site replaces a static SPA that could not break, and a portfolio that
 * 500s because a free-tier backend is asleep is worse than one showing an empty
 * section. Failures are logged server-side so they are not actually silent.
 */

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

/** Content changes when the owner edits it, which is rarely. */
const REVALIDATE_SECONDS = 300;

/** A hung backend must not hang the page render along with it. */
const TIMEOUT_MS = 5000;

/**
 * What the caller is prepared to receive.
 *
 * `response.json()` returns `any`, and the cast that follows it is a promise
 * the API makes rather than something checked. When the API keeps that promise
 * the cast is free; when something between here and it does not — a gateway
 * answering 200 with `{"detail": ...}`, a tunnel serving its own JSON — the
 * cast hands a list-shaped variable something that is not a list, and the page
 * throws on `.map()`. That is a 500 caused by a *successful* request, which is
 * the one failure mode the rest of this module is built to rule out.
 */
type ShapeCheck = (data: unknown) => boolean;

const isList: ShapeCheck = (data) => Array.isArray(data);

/** A detail route sends one object; an array or a bare string is not it. */
const isRecord: ShapeCheck = (data) =>
  typeof data === "object" && data !== null && !Array.isArray(data);

/**
 * Cache tags, one per content type.
 *
 * These are what the console's writes invalidate. Tagging rather than listing
 * paths is not a tidiness preference — it is the only version that works. A
 * publish toggle knows a row's id and nothing else, so it cannot name
 * `/blog/the-slug`; and `revalidatePath("/blog/[slug]", "page")` did not clear
 * the prerendered detail pages, which left an unpublished post still readable
 * at its URL, body and all, while the API was correctly 404ing it. A tag
 * invalidates every page that read the tagged response, whatever its path.
 */
export const CONTENT_TAGS = {
  projects: "projects",
  skills: "skills",
  certificates: "certificates",
  career: "career",
  posts: "posts",
} as const;

export type ContentTag = (typeof CONTENT_TAGS)[keyof typeof CONTENT_TAGS];

/**
 * A read, plus whether the API actually answered it.
 *
 * Every reader below returns a fallback on failure, which is what keeps the
 * site up when the backend is asleep — and which also makes an empty list
 * ambiguous: it means "nothing published" and "nothing reachable" equally. The
 * home page's topology claims one of its nodes is *live*, and a claim like that
 * has to be answerable. `ok` is that answer, and it is the only thing that
 * separates the two cases.
 */
export type Read<T> = { data: T; ok: boolean };

async function readJson<T>(
  path: string,
  fallback: T,
  isExpectedShape: ShapeCheck,
  tag: ContentTag,
): Promise<Read<T>> {
  const url = `${API_URL}/api/v1${path}`;

  try {
    const response = await fetch(url, {
      // `revalidate` is still the backstop for a change made anywhere but the
      // console — the seed script, or psql.
      next: { revalidate: REVALIDATE_SECONDS, tags: [tag] },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      // A 404 on a detail route is the caller's business, not an outage; it is
      // reported the same way here and distinguished by the caller's fallback.
      console.error(`[api] ${response.status} ${response.statusText} for ${url}`);
      return { data: fallback, ok: false };
    }

    const data = await response.json();

    if (!isExpectedShape(data)) {
      console.error(`[api] unexpected shape from ${url}:`, data);
      return { data: fallback, ok: false };
    }

    return { data: data as T, ok: true };
  } catch (error) {
    // Covers DNS failure, connection refused, and the timeout above.
    console.error(`[api] request to ${url} failed:`, error);
    return { data: fallback, ok: false };
  }
}

/** The shape almost every caller wants: the data, and no opinion about why. */
async function getJson<T>(
  path: string,
  fallback: T,
  isExpectedShape: ShapeCheck,
  tag: ContentTag,
): Promise<T> {
  const { data } = await readJson(path, fallback, isExpectedShape, tag);
  return data;
}

/**
 * Fill in list fields the API may not be sending yet.
 *
 * `gallery` and `links` arrived after this app could already be deployed
 * without them, and the two halves ship independently — Vercel on push, Fly on
 * a change under apps/api. So there is a window, every time, where the web app
 * asks for a field the API has never heard of and gets `undefined` back.
 *
 * The type says `ProjectLink[]`, and `getJson` only checks that the body is an
 * object — it does not look inside. Without this, `project.links.length` on the
 * detail page throws during render and the project 500s, which is precisely the
 * failure the fallbacks in this file exist to prevent. It is also invisible
 * locally, because local development points at whichever API you are running.
 *
 * Normalising here rather than guarding at each use keeps the type honest:
 * every consumer can trust the array exists because this is where it is made
 * to.
 */
function withLists(project: Project): Project {
  return {
    ...project,
    technologies: project.technologies ?? [],
    features: project.features ?? [],
    challenges: project.challenges ?? [],
    gallery: project.gallery ?? [],
    links: project.links ?? [],
  };
}

export async function getProjects(): Promise<Project[]> {
  const projects = await getJson<Project[]>(
    "/projects/",
    [],
    isList,
    CONTENT_TAGS.projects,
  );
  return projects.map(withLists);
}

/**
 * The projects read, with the outcome kept.
 *
 * Only the home page needs this: it draws the request path that served the
 * page, and the API node on that drawing is lit or dim depending on whether
 * this very read succeeded. Everywhere else wants `getProjects` — a sitemap has
 * nothing to say about reachability.
 */
export async function readProjects(): Promise<Read<Project[]>> {
  const read = await readJson<Project[]>("/projects/", [], isList, CONTENT_TAGS.projects);
  return { ...read, data: read.data.map(withLists) };
}

export async function getProject(slug: string): Promise<Project | null> {
  const project = await getJson<Project | null>(
    `/projects/slug/${encodeURIComponent(slug)}`,
    null,
    isRecord,
    CONTENT_TAGS.projects,
  );
  return project && withLists(project);
}

export async function getSkills(): Promise<Skill[]> {
  return getJson<Skill[]>("/skills/", [], isList, CONTENT_TAGS.skills);
}

export async function getCertificates(): Promise<Certificate[]> {
  return getJson<Certificate[]>("/certificates/", [], isList, CONTENT_TAGS.certificates);
}

export async function getCareerEntries(): Promise<CareerEntry[]> {
  return getJson<CareerEntry[]>("/career/", [], isList, CONTENT_TAGS.career);
}

/**
 * Published posts, newest first — the API decides the order, not the caller.
 *
 * No tag parameter, though the API takes one. The index has to know every tag
 * that exists in order to draw the facets, and a response already filtered to
 * one tag cannot tell it about the others; so the page fetches the whole list
 * once and narrows it itself. One request, complete facets, and the filtered
 * view costs no second round trip.
 */
export async function getPosts(): Promise<Post[]> {
  return getJson<Post[]>("/posts/", [], isList, CONTENT_TAGS.posts);
}

export async function getPost(slug: string): Promise<Post | null> {
  return getJson<Post | null>(
    `/posts/slug/${encodeURIComponent(slug)}`,
    null,
    isRecord,
    CONTENT_TAGS.posts,
  );
}
