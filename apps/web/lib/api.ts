import "server-only";

import type { CareerEntry, Certificate, Project, Skill } from "./types";

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

async function getJson<T>(path: string, fallback: T): Promise<T> {
  const url = `${API_URL}/api/v1${path}`;

  try {
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      // A 404 on a detail route is the caller's business, not an outage; it is
      // reported the same way here and distinguished by the caller's fallback.
      console.error(`[api] ${response.status} ${response.statusText} for ${url}`);
      return fallback;
    }

    return (await response.json()) as T;
  } catch (error) {
    // Covers DNS failure, connection refused, and the timeout above.
    console.error(`[api] request to ${url} failed:`, error);
    return fallback;
  }
}

export async function getProjects(): Promise<Project[]> {
  return getJson<Project[]>("/projects/", []);
}

export async function getProject(slug: string): Promise<Project | null> {
  return getJson<Project | null>(`/projects/slug/${encodeURIComponent(slug)}`, null);
}

export async function getSkills(): Promise<Skill[]> {
  return getJson<Skill[]>("/skills/", []);
}

export async function getCertificates(): Promise<Certificate[]> {
  return getJson<Certificate[]>("/certificates/", []);
}

export async function getCareerEntries(): Promise<CareerEntry[]> {
  return getJson<CareerEntry[]>("/career/", []);
}
