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
