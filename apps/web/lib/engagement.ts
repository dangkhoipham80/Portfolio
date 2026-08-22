import "server-only";

import { headers } from "next/headers";

import type { PostComment, RatingSummary } from "./types";

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
  | { ok: false; reason: "rejected"; message: string }
  | { ok: false; reason: "rate_limited"; retryAfter: number | null }
  | { ok: false; reason: "unavailable" };

async function post<T>(path: string, body: unknown): Promise<WriteResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(await visitorHeaders()),
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

export async function submitComment(
  postId: number,
  payload: { author_name: string; author_email: string; body: string; parent_id?: number },
): Promise<WriteResult<PostComment>> {
  return post<PostComment>(`/posts/${postId}/comments`, payload);
}

export async function submitRating(
  postId: number,
  stars: number,
): Promise<WriteResult<RatingSummary>> {
  return post<RatingSummary>(`/posts/${postId}/rating`, { stars });
}
