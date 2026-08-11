/**
 * Mirrors app/schemas/portfolio.py.
 *
 * Hand-written rather than generated. The API publishes an OpenAPI document at
 * /api/v1/openapi.json, so these could be generated — but that would make the
 * build depend on a reachable API, and the whole point of the fetch layer below
 * is that a sleeping backend must not take the site down. Keep them in sync by
 * hand; there are four shapes and they change rarely.
 */

/** Enum values are the lowercase member values, not the names. */
export type ProjectStatus = "completed" | "in_progress" | "on_hold" | "dropped";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export interface Project {
  id: number;
  slug: string;
  title: string;
  /** Card blurb. */
  description: string;
  /** Detail-page body. Null on rows seeded before it existed. */
  long_description: string | null;
  image_url: string | null;
  github_url: string | null;
  live_url: string | null;
  technologies: string[];
  features: string[];
  challenges: string[];
  /** ISO date, or null. A null `ended_on` means the work is ongoing. */
  started_on: string | null;
  ended_on: string | null;
  status: ProjectStatus;
  featured: boolean;
  published: boolean;
  order: number;
  created_at: string;
  updated_at: string | null;
}

export interface Skill {
  id: number;
  name: string;
  category: string;
  level: SkillLevel;
  icon: string | null;
  order: number;
  created_at: string;
  updated_at: string | null;
}

export interface Certificate {
  id: number;
  slug: string;
  title: string;
  issuer: string;
  issue_date: string;
  credential_id: string | null;
  credential_url: string | null;
  image_url: string | null;
  description: string | null;
  category: string | null;
  skills: string[];
  published: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * A contact-form submission, as the admin inbox reads it.
 *
 * `Contact` in the API, not `ContactCreate`: the response model deliberately
 * inherits the loose base rather than the validated one, because rows predating
 * validation would otherwise 500 the list on the way out.
 */
export interface Contact {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface Post {
  id: number;
  slug: string;
  title: string;
  /** Card blurb and meta description. Null falls back to the body's opening. */
  excerpt: string | null;
  /** Markdown. The API never renders it; lib/markdown.ts does, server-side. */
  body: string;
  tags: string[];
  cover_image: string | null;
  published: boolean;
  /**
   * When the post went live — not `created_at`, which is when the draft row was
   * made. Null only on a draft, which the public API never returns.
   */
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
}

/** What POST /auth/login and POST /auth/refresh return. */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  /** Seconds until the access token expires. Drives the cookie's max-age. */
  expires_in: number;
  user_id: number;
  email: string;
}

export interface CareerEntry {
  id: number;
  slug: string;
  title: string;
  company: string;
  location: string | null;
  started_on: string;
  /** Null means "Present". */
  ended_on: string | null;
  highlights: string[];
  published: boolean;
  created_at: string;
  updated_at: string | null;
}
