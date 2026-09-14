import "server-only";

import { headers } from "next/headers";

import type { PostComment, RatingSummary, ReadingProgress } from "./types";
import { readerToken } from "./viewer-server";

/**
 * The two things a reader can write, and the one read that is about them.
 *
 * ## Why this is not in lib/api.ts
 *
 * Every read in that module is cached and made with this server's own identity,
 * which is exactly wrong here. The API works out who a visitor is from the
 * address and user agent of whoever called it — and because the browser never
 * talks to the API directly, that is always the Next server. Without forwarding
 * the real headers, every visitor in the world would be one voter with one vote
 * and one rate-limit bucket.
 *
 * So these calls forward `X-Forwarded-For` and `User-Agent`, the same
 * arrangement app/actions/contact.ts already uses so the API rate-limits the
 * right person, and nothing here is cached.
 *
 * ## Why some of these carry a token
 *
 * Commenting and reading progress belong to an account, so those calls go out
 * with the reader's own bearer token — read from the httpOnly cookie on the
 * server, never handled in the browser. Ratings and the rating summary do not:
 * they are keyed on the visitor hash above and are open to anyone, signed in or
 * not.
 *
 * ## Why failures are reported rather than swallowed
 *
 * lib/api.ts returns a fallback on every failure, because a portfolio that 500s
 * when its backend is asleep is worse than one showing an empty section. That
 * is right for reads and wrong for writes: "your comment went nowhere" is
 * precisely the thing the person has to be told. The read below keeps the
 * fallback; the writes return a discriminated result.
 */

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

/** A hung backend must not hang the page render or the submit button. */
const TIMEOUT_MS = 8000;

const NO_RATING: RatingSummary = {
  average: 0,
  count: 0,
  distribution: [0, 0, 0, 0, 0],
  mine: null,
};

/**
 * The visitor's own identity, as far as the API is concerned.
 *
 * `X-Forwarded-For` is passed through unchanged rather than rebuilt: the API
 * takes the left-most entry as the original client, and the header arriving
 * here already has it there. The user agent matters too — it is half of the
 * hash the API keys a voter on, so dropping it would put every browser on one
 * address into the same bucket.
 */
async function visitorHeaders(): Promise<Record<string, string>> {
  const incoming = await headers();
  const forwarded = incoming.get("x-forwarded-for");
  const agent = incoming.get("user-agent");

  return {
    ...(forwarded ? { "X-Forwarded-For": forwarded } : {}),
    ...(agent ? { "User-Agent": agent } : {}),
  };
}

/**
 * A post's star summary, as this particular visitor.
 *
 * Falls back to an unrated summary on any failure, like the readers in
 * lib/api.ts: the stars are a decoration on someone else's writing, and a
 * sleeping backend must not take the post down with it.
 */
export async function readRating(postId: number): Promise<RatingSummary> {
  try {
    const response = await fetch(`${API_URL}/api/v1/posts/${postId}/rating`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", ...(await visitorHeaders()) },
    });

    if (!response.ok) return NO_RATING;

    const data = await response.json();
    // Same shape check as lib/api.ts, and for the same reason: a gateway
    // answering 200 with something else would otherwise reach the component as
    // a summary whose `distribution` is not an array, and `.map()` would throw
    // during render.
    return isSummary(data) ? data : NO_RATING;
  } catch {
    return NO_RATING;
  }
}

function isSummary(data: unknown): data is RatingSummary {
  const value = data as RatingSummary | null;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.average === "number" &&
    typeof value.count === "number" &&
    Array.isArray(value.distribution)
  );
}

/** What a write can come back as. `rate_limited` carries the wait, in seconds. */
export type WriteResult<T> =
  | { ok: true; data: T }
  /**
   * Signed out, or signed in with an unconfirmed address. Two different things
   * with two different remedies, which is why `needsVerification` is here and
   * not left to the caller to infer from the message.
   */
  | { ok: false; reason: "unauthorised"; needsVerification: boolean; message: string }
  | { ok: false; reason: "rejected"; message: string }
  | { ok: false; reason: "rate_limited"; retryAfter: number | null }
  | { ok: false; reason: "unavailable" };

async function post<T>(
  path: string,
  body: unknown,
  options: { authenticated?: boolean; method?: "POST" | "PUT" } = {},
): Promise<WriteResult<T>> {
  let response: Response;

  // Read here rather than by the callers, so the one place a reader's token is
  // attached to an outbound request is also the one place that can be read to
  // find out which routes carry it.
  const token = options.authenticated ? await readerToken() : null;

  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method: options.method ?? "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(await visitorHeaders()),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // DNS failure, connection refused, or the timeout above.
    return { ok: false, reason: "unavailable" };
  }

  if (response.status === 429) {
    const header = response.headers.get("retry-after");
    const seconds = header ? Number(header) : Number.NaN;
    return {
      ok: false,
      reason: "rate_limited",
      retryAfter: Number.isFinite(seconds) ? seconds : null,
    };
  }

  if (response.status === 401 || response.status === 403) {
    // Not a "rejected" payload: nothing about what was typed is wrong, and the
    // API's own sentence says which of the two it is — sign in, or confirm your
    // address. The form turns that into the right control.
    return {
      ok: false,
      reason: "unauthorised",
      needsVerification: response.status === 403,
      message: await detailFrom(response),
    };
  }

  if (response.status === 422 || response.status === 400) {
    return { ok: false, reason: "rejected", message: await detailFrom(response) };
  }

  if (!response.ok) return { ok: false, reason: "unavailable" };

  try {
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * The API's own sentence for a rejection, when it has one worth showing.
 *
 * The service raises these with the reader in mind — "That comment cannot be
 * replied to" — so they are usable as-is. pydantic's are not: they are written
 * for an API consumer and name the schema field, so anything shaped like a
 * validation-error list gets our wording instead.
 */
async function detailFrom(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = (body as { detail?: unknown })?.detail;
    if (typeof detail === "string") return detail;
  } catch {
    // Fall through to the generic line.
  }

  return "The server would not accept that. Check the fields and try again.";
}

/**
 * Post a comment as the signed-in reader.
 *
 * The payload carries prose and a parent and nothing else. The name and the
 * address on the stored comment come from the account the token resolves to —
 * the API's request schema has no field for either, so there is nothing this
 * function could send that would change who the comment is from. See
 * PostCommentCreate in apps/api/app/schemas/portfolio.py.
 */
export async function submitComment(
  postId: number,
  payload: { body: string; parent_id?: number },
): Promise<WriteResult<PostComment>> {
  return post<PostComment>(`/posts/${postId}/comments`, payload, {
    authenticated: true,
  });
}

/**
 * Record how far the signed-in reader has got through a post.
 *
 * A PUT rather than a POST: it is idempotent, and the resource is "this
 * reader's progress on this post" — one thing at one address, however many
 * times it is written. These go out while somebody scrolls, so a verb that
 * promises a new resource each time would be a lie about what a retry does.
 */
export async function saveProgress(
  postId: number,
  progress: number,
  finished?: boolean,
): Promise<WriteResult<ReadingProgress>> {
  return post<ReadingProgress>(
    `/reading/posts/${postId}`,
    { progress, ...(finished === undefined ? {} : { finished }) },
    { authenticated: true, method: "PUT" },
  );
}

/**
 * This reader's progress on one post, or null.
 *
 * Null covers three different things — not signed in, never opened, API down —
 * and the caller treats them the same because there is nothing else it could
 * do: all three mean "no position to restore".
 */
export async function readProgress(postId: number): Promise<ReadingProgress | null> {
  const token = await readerToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_URL}/api/v1/reading/posts/${postId}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;
    return (await response.json()) as ReadingProgress;
  } catch {
    return null;
  }
}

/**
 * One post, whole, as the signed-in reader.
 *
 * Straight to the API with their own token rather than through lib/api.ts,
 * whose reads are cached and made with this server's identity — both of which
 * are exactly wrong for a response that depends on who asked.
 *
 * Null for a caller with no session, for a post that is not there, and for an
 * API that did not answer. All three mean the same thing to the gate: it stays
 * shut and says so.
 */
export async function readWholePost(
  slug: string,
): Promise<{ body: string; format: "markdown" | "mdx" } | null> {
  const token = await readerToken();
  if (!token) return null;

  try {
    const response = await fetch(
      `${API_URL}/api/v1/posts/slug/${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) return null;

    const post = (await response.json()) as {
      body?: string;
      format?: "markdown" | "mdx";
    };

    return post?.body ? { body: post.body, format: post.format ?? "markdown" } : null;
  } catch {
    return null;
  }
}

/** Everything this reader has open, most recently read first. */
export async function readReadingList(): Promise<ReadingProgress[]> {
  const token = await readerToken();
  if (!token) return [];

  try {
    const response = await fetch(`${API_URL}/api/v1/reading/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return [];

    const data = await response.json();
    // Same shape check as lib/api.ts, and for the same reason: an object where
    // a list belongs throws on `.map()` during render — a 500 produced by a
    // successful request.
    return Array.isArray(data) ? (data as ReadingProgress[]) : [];
  } catch {
    return [];
  }
}

export async function submitRating(
  postId: number,
  stars: number,
): Promise<WriteResult<RatingSummary>> {
  return post<RatingSummary>(`/posts/${postId}/rating`, { stars });
}
