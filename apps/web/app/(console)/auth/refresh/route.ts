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
 * drops the access cookie at the moment the access token stops working. While a
 * session is live nothing reaches this route at all — it is not a check that
 * runs on every request, it is the branch taken once an hour.
 *
 * ## Why GET
 *
 * It is reached by redirecting a navigation, and a redirect is always a GET.
 * That makes it reachable cross-site, which is why it does nothing but exchange
 * one credential the caller already holds for another: it reads no input beyond
 * `next`, which is validated, and reveals nothing in its response.
 *
 * ## Why the response is built by hand
 *
 * Two reasons, both found by watching a renewal silently fail.
 *
 * The Location is a **relative path**. `NextResponse.redirect` needs an
 * absolute URL, and the obvious way to build one is `new URL(target,
 * request.nextUrl)` — which resolved to `localhost` while the browser was on
 * `127.0.0.1`. Those are two different hosts as far as cookies are concerned,
 * so the pair set on that response was stored against a host the next request
 * never came from, and the caller arrived back at /admin with no session at
 * all — an infinite bounce to the sign-in screen. A relative Location keeps the
 * browser on whatever host it is already using, which is also what makes this
 * correct behind a proxy, where the host Next sees and the host the browser
 * used are routinely different.
 *
 * The Set-Cookie headers are serialised explicitly because neither
 * `response.cookies.set` nor `cookies().set` survived onto a redirect from a
 * route handler here — the headers were present on the object being returned
 * and absent from the wire.
 */
function serialise({ name, value, options }: SessionCookie): string {
  const parts = [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite}`,
  ];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");

  return parts.join("; ");
}

function redirectTo(path: string, updates: SessionCookie[]): Response {
  const headers = new Headers({ Location: path });
  for (const cookie of updates) headers.append("Set-Cookie", serialise(cookie));

  // 303 rather than 307: what follows is a fresh GET of a page, and 307 would
  // preserve a method this route never wants replayed.
  return new Response(null, { status: 303, headers });
}

export async function GET(request: NextRequest) {
  const target = safeNextPath(request.nextUrl.searchParams.get("next"));
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // Both failure paths end the session rather than leaving a credential behind
  // that will fail the same way on the next navigation — and would send the
  // caller back through here every time, in a loop.
  const giveUp = () => redirectTo(LOGIN_PATH, clearedSessionCookies());

  if (!refreshToken) return giveUp();

  // Expired, or revoked by a sign-out that already happened elsewhere.
  const result = await refreshSession(refreshToken);
  if (!result.ok) return giveUp();

  // The API rotates on refresh: it revokes the token just spent and issues a
  // new pair. Both cookies are replaced, not just the access one, or the next
  // renewal presents a refresh token the API has already retired.
  return redirectTo(target, sessionCookies(result.data));
}
