/**
 * Mirrors app/schemas/portfolio.py.
 *
 * Hand-written rather than generated. The API publishes an OpenAPI document at
 * /api/v1/openapi.json, so these could be generated — but that would make the
 * build depend on a reachable API, and the whole point of the fetch layer below
 * is that a sleeping backend must not take the site down. Keep them in sync by
 * hand; there are four shapes and they change rarely.
 */

import type { LanguageCode } from "./languages";

/** Enum values are the lowercase member values, not the names. */
export type ProjectStatus = "completed" | "in_progress" | "on_hold" | "dropped";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

/**
 * A gallery entry, as the API returns it.
 *
 * The project row stores a bare URL; `alt` and the dimensions are resolved from
 * the media library on the way out, so a description lives in one place rather
 * than being copied into every project that uses the image. All three are null
 * for a URL the library has never seen — pasted by hand, or uploaded before the
 * library existed.
 */
export interface GalleryImage {
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

/** A labelled link beyond source and live: a demo video, a case study. */
export interface ProjectLink {
  label: string;
  url: string;
}

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
  /** Demo screenshots beyond the cover, in display order. */
  gallery: GalleryImage[];
  links: ProjectLink[];
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

/** How a post's body should be read. See lib/mdx.tsx for what MDX may contain. */
export type PostFormat = "markdown" | "mdx";

export type { LanguageCode } from "./languages";

/**
 * A tag as it appears inside a post.
 *
 * Both halves, because the consumer needs one for the link and the other for
 * the label — a bare string could only supply one, which is why the API stopped
 * sending a list of names.
 */
export interface TagRef {
  id: number;
  slug: string;
  name: string;
}

export interface Tag extends TagRef {
  description: string | null;
  /** Posts carrying it that this caller can see. Drafts excluded for the public. */
  post_count: number;
  created_at: string;
  updated_at: string | null;
}

/** A series as it appears inside a post — no post list, or the type recurses. */
export interface SeriesRef {
  id: number;
  slug: string;
  title: string;
}

export interface Series extends SeriesRef {
  description: string | null;
  cover_image: string | null;
  published: boolean;
  post_count: number;
  created_at: string;
  updated_at: string | null;
}

/**
 * One language version of a post, as it appears on another version.
 *
 * Not a whole `Post`: the switcher needs a language to label the link, a slug to
 * point it at and a title for its accessible name. Embedding the full row would
 * put every translation's body inside every other translation's response.
 */
export interface PostTranslationRef {
  id: number;
  slug: string;
  title: string;
  language: LanguageCode;
}

export interface Post {
  id: number;
  slug: string;
  title: string;
  /** Card blurb and meta description. Null falls back to the body's opening. */
  excerpt: string | null;
  /** Markdown or MDX per `format`. The API never renders it; the web app does. */
  body: string;
  format: PostFormat;
  /** What it is written in. Goes into the `lang` attribute; see lib/languages.ts. */
  language: LanguageCode;
  /** Null means the site owner, which is who wrote all of them so far. */
  author_name: string | null;
  /** The post this one was translated from, when it is a translation. */
  translation_of: PostTranslationRef | null;
  /**
   * The other language versions of this post, this one excluded — the original
   * as well as its siblings, whichever end you are reading from. Drafts are
   * filtered out by the API for anyone who is not an admin.
   */
  translations: PostTranslationRef[];
  tags: TagRef[];
  series: SeriesRef | null;
  /** Position within the series, lowest first. Meaningless without one. */
  series_order: number;
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

/**
 * A comment as the public API returns it.
 *
 * No email address and no author hash: the API's response model cannot express
 * either, so there is nothing to leak here even by accident.
 */
export interface PostComment {
  id: number;
  post_id: number;
  /** Null on a top-level comment. Threading is one level deep. */
  parent_id: number | null;
  author_name: string;
  body: string;
  created_at: string;
}

export type CommentStatus = "pending" | "approved" | "rejected";

/** The moderation view. Admin-only, and carries what the public shape will not. */
export interface PostCommentAdmin extends PostComment {
  author_email: string;
  status: CommentStatus;
  author_hash: string | null;
  post_slug: string | null;
  post_title: string | null;
}

/**
 * A post's stars.
 *
 * `count` travels with `average` everywhere it is shown: 5.0 from one vote and
 * 4.6 from fifty are not the same claim, and a mean alone cannot tell them
 * apart.
 */
export interface RatingSummary {
  average: number;
  count: number;
  /** The five bucket counts, one star to five. */
  distribution: number[];
  /** This visitor's standing vote, if they have one. */
  mine: number | null;
}

/** A past version of a post. Admin-only; the public API never serves one. */
export interface PostRevision {
  id: number;
  post_id: number;
  title: string;
  excerpt: string | null;
  body: string;
  format: PostFormat;
  tag_slugs: string[];
  note: string | null;
  created_at: string;
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
