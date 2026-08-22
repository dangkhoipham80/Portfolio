import "server-only";

import type {
  CareerEntry,
  Certificate,
  Post,
  PostComment,
  Project,
  Series,
  Skill,
  Tag,
  TagRef,
} from "./types";

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
  // Tags and series are their own content types in the console, but every
  // public page that reads one also reads posts — a facet list is meaningless
  // without the posts it counts. They keep their own tag so the console can
  // invalidate a rename without dropping every post page as well.
  blogTags: "blog-tags",
  series: "series",
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
 * Fill in the post fields the API may not be sending yet, and normalise tags.
 *
 * Same job as `withLists` above, and the same reason: the two halves deploy
 * independently, so there is a window on every release where the web app asks
 * for a field the API has never heard of. `post.tags.map()` on `undefined`
 * throws during render, which 500s the page the fallbacks exist to keep up.
 *
 * The tag normalisation is the interesting half. Tags used to be a list of
 * plain strings and are now `{id, slug, name}` objects. During the window
 * between deploying the API and deploying this app — and in the other
 * direction, if a rollback puts the old API back — one side sends strings and
 * the other expects objects. Accepting both here means the blog degrades to
 * "tags that link to the right place, derived from the name" rather than
 * rendering `[object Object]` across the index.
 */
function withPostLists(post: Post): Post {
  const raw = (post.tags ?? []) as unknown as (TagRef | string)[];

  return {
    ...post,
    format: post.format ?? "markdown",
    series: post.series ?? null,
    series_order: post.series_order ?? 0,
    tags: raw.map((tag, index) =>
      typeof tag === "string"
        ? // Negative ids so a synthesised ref can never collide with a real
          // row's, in case something downstream keys on it.
          { id: -1 - index, slug: slugishly(tag), name: tag }
        : tag,
    ),
  };
}

/**
 * The old API's tag string, reduced to something usable as a URL segment.
 *
 * Deliberately not a copy of the API's `slugify`: it does not need to agree
 * with it, because it only ever runs when the API is old enough not to be
 * sending slugs at all. It exists so a link goes *somewhere* during a deploy
 * rather than being built from a name with spaces in it.
 */
function slugishly(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Published posts, newest first — the API decides the order, not the caller.
 *
 * No tag parameter, though the API takes one. The index has to know every tag
 * that exists in order to draw the facets, and a response already filtered to
 * one tag cannot tell it about the others; so the page fetches the whole list
 * once and narrows it itself. One request, complete facets, and the filtered
 * view, the search and the pagination all cost no second round trip.
 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getJson<Post[]>("/posts/", [], isList, CONTENT_TAGS.posts);
  return posts.map(withPostLists);
}

export async function getPost(slug: string): Promise<Post | null> {
  const post = await getJson<Post | null>(
    `/posts/slug/${encodeURIComponent(slug)}`,
    null,
    isRecord,
    CONTENT_TAGS.posts,
  );
  return post && withPostLists(post);
}

/**
 * Every tag, with the number of published posts under each.
 *
 * Empty ones are dropped here rather than by each caller: the API includes them
 * because the console needs to offer a tag you have just created and not yet
 * used, and a facet on the public site that leads to an empty list is worse
 * than no facet at all.
 */
export async function getTags(): Promise<Tag[]> {
  const tags = await getJson<Tag[]>("/tags/", [], isList, CONTENT_TAGS.blogTags);
  return tags.filter((tag) => tag.post_count > 0);
}

/** One tag, for its own page. Null covers both a 404 and an outage. */
export async function getTag(slug: string): Promise<Tag | null> {
  return getJson<Tag | null>(
    `/tags/slug/${encodeURIComponent(slug)}`,
    null,
    isRecord,
    CONTENT_TAGS.blogTags,
  );
}

export async function getSeriesList(): Promise<Series[]> {
  return getJson<Series[]>("/series/", [], isList, CONTENT_TAGS.series);
}

export async function getSeries(slug: string): Promise<Series | null> {
  return getJson<Series | null>(
    `/series/slug/${encodeURIComponent(slug)}`,
    null,
    isRecord,
    CONTENT_TAGS.series,
  );
}

/** A series' posts in reading order — oldest first, unlike every other listing. */
export async function getSeriesPosts(slug: string): Promise<Post[]> {
  const posts = await getJson<Post[]>(
    `/series/slug/${encodeURIComponent(slug)}/posts`,
    [],
    isList,
    CONTENT_TAGS.series,
  );
  return posts.map(withPostLists);
}

/**
 * Approved comments on a post, oldest first.
 *
 * Cached and tagged like every other read here, which is what keeps the post
 * pages prerendered — a `no-store` fetch anywhere in a page opts the whole
 * route into per-request rendering, and this one turned every post on the site
 * from static HTML into a server render. The build output is where that showed
 * up, not the browser.
 *
 * Freshness comes from the tag instead: approving a comment calls
 * `updateTag(CONTENT_TAGS.posts)`, which expires the thread immediately. Same
 * arrangement the console already uses for publishing a post, and the same
 * reason it is a tag rather than a path — the action knows an id and nothing
 * else, so it could not name the post's URL even if it wanted to.
 */
export async function getPostComments(postId: number): Promise<PostComment[]> {
  return getJson<PostComment[]>(`/posts/${postId}/comments`, [], isList, CONTENT_TAGS.posts);
}

/*
 * There is deliberately no rating reader here.
 *
 * A rating response carries `mine` — this visitor's own standing vote — and
 * every read in this module is either cached or, at best, made with the Next
 * server's own identity. Both are wrong for it: a cached entry would show one
 * reader another reader's choice, and an uncached one would still ask the API
 * "what did *this server* vote?", because the API keys a visitor on the address
 * and user agent of whoever called it. Proxied through here, that is always us.
 *
 * So ratings live in lib/engagement.ts, which forwards the visitor's own
 * headers — the same thing app/actions/contact.ts already does so the API rate
 * limits the right person.
 */
