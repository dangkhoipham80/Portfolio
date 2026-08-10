import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { refreshSession } from "@/lib/console-api";
import {
  clearedSessionCookies,
  LOGIN_PATH,
  REFRESH_COOKIE,
  safeNextPath,
  type SessionCookie,
  sessionCookies,
} from "@/lib/session";

/**
 * Renews an expired session and sends the caller back where they were going.
 *
 * ## Why this is a route handler and not part of the admin layout
 *
 * A server component cannot set a cookie — only Server Actions and route
 * handlers can. The admin layout is where an expired session is *noticed*, so
 * it redirects here, this mints the new pair onto a redirect response, and the
 * browser arrives back at the original path with a live cookie.
 *
 * ## Why it costs nothing on the happy path
 *
 * Each session cookie's max-age matches its token's lifetime, so the browser
 * drops the access cookie at the moment the access token stops working. While
 * a session is live nothing reaches this route at all — it is not a check that
 * runs on every request, it is the branch taken once an hour.
 *
 * ## Why GET
 *
 * It is reached by redirecting a navigation, and a redirect is always a GET.
 * That makes it reachable cross-site, which is why it does nothing but exchange
 * one credential the caller already holds for another: it reads no input beyond
 * `next`, which is validated, and reveals nothing in its response.
 */
function redirectWith(to: URL, cookies: SessionCookie[]): NextResponse {
  const response = NextResponse.redirect(to);
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

export async function GET(request: NextRequest) {
  const target = safeNextPath(request.nextUrl.searchParams.get("next"));
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // Both failure paths end the session rather than leaving a credential behind
  // that will fail the same way on the next navigation — and would send the
  // caller back through here every time, in a loop.
  const giveUp = () =>
    redirectWith(new URL(LOGIN_PATH, request.nextUrl), clearedSessionCookies());

  if (!refreshToken) return giveUp();

  // Expired, or revoked by a sign-out that already happened elsewhere.
  const result = await refreshSession(refreshToken);
  if (!result.ok) return giveUp();

  // The API rotates on refresh: it revokes the token just spent and issues a
  // new pair. Both cookies are replaced, not just the access one, or the next
  // renewal presents a refresh token the API has already retired.
  return redirectWith(new URL(target, request.nextUrl), sessionCookies(result.data));
}
