import "server-only";

import { cookies } from "next/headers";

import { type CurrentUser, fetchCurrentUser } from "./console-api";
import { ACCESS_COOKIE } from "./session";
import type { Viewer } from "./viewer";

/**
 * Who is reading, as far as the public site is concerned.
 *
 * ## Why this is not lib/admin-guard.ts
 *
 * That module answers one question — may this caller into /admin — and answers
 * it with a redirect. This one answers a different question that has no wrong
 * answer: who, if anyone, is signed in. A signed-out visitor is not a failure
 * here, it is the ordinary case and the one most page loads are.
 *
 * Keeping them apart matters more than it looks. `requireAdmin` is allowed to
 * be strict because everything behind it is the owner's; anything on the public
 * site that consulted it would turn a reader into an intruder.
 *
 * ## Why nothing on the public site awaits this during render
 *
 * Because reading a cookie during render opts the whole route out of static
 * rendering, and every page on this site is prerendered. The header would be
 * the worst possible place to do it: it renders on every page, to answer a
 * question most visitors answer "nobody".
 *
 * So the pages stay static and the browser asks afterwards, through
 * app/api/session/route.ts. Same arrangement, and the same reasoning, as the
 * star rating in components/blog/rating.tsx.
 */

function asViewer(user: CurrentUser): Viewer {
  return {
    // The API's fallback order, kept: an address is a poor display name and a
    // better one than a word nobody chose.
    name: user.full_name ?? user.email,
    email: user.email,
    // `roles` is still checked as well as `is_admin`, so an API deployed before
    // that field existed does not quietly demote the owner mid-release.
    isAdmin: user.is_admin ?? user.roles?.includes("admin") ?? false,
    isVerified: user.is_verified ?? false,
    streak: user.login_streak ?? 0,
  };
}

/**
 * The signed-in reader, or null.
 *
 * Asks the API rather than trusting the presence of a cookie, so a revoked or
 * expired token renders as signed out instead of as a session that fails on the
 * first thing it is used for.
 *
 * Unlike `requireAdmin` this never attempts renewal. Renewal is a redirect
 * through /auth/refresh, which is the one thing a route handler cannot do — so
 * an aged-out session is simply "nobody" here, and the reader signs in again by
 * navigating.
 */
export async function readViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const result = await fetchCurrentUser(token);
  return result.ok ? asViewer(result.data) : null;
}

/**
 * The access token, for a call that has to be made as the reader.
 *
 * Separate from `readViewer` and deliberately awkward to reach: the token
 * authorises every write this account can make, so the places that hold it
 * should be countable. Only server-side code can import this module at all —
 * `server-only` at the top is a build error, not a convention.
 */
export async function readerToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}
