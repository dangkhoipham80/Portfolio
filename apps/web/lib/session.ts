import "server-only";

import type { TokenPair } from "./types";

/**
 * The admin session, as cookies.
 *
 * The API is Bearer-token only and no browser ever talks to it directly — the
 * Next server holds the token and calls the API itself. So the token goes into
 * an httpOnly cookie the browser cannot read, rather than localStorage: an
 * injected script on the public site can read localStorage, and this token
 * authorises every write route on the API.
 *
 * Nothing here signs or encrypts anything. The cookie value *is* the API's JWT,
 * which the API validates on every call — against its own signing key and
 * against the token table, so a logged-out token is refused even though its
 * signature is still good. A second layer of session encryption on top would be
 * two things to get wrong instead of one.
 */

export const ACCESS_COOKIE = "pf_access";
export const REFRESH_COOKIE = "pf_refresh";

/** Where an unauthenticated caller is sent, and where sign-in lands. */
export const LOGIN_PATH = "/login";
export const ADMIN_PATH = "/admin";
/** Where a reader lands when nothing more specific was asked for. */
export const SITE_PATH = "/";
export const REFRESH_PATH = "/auth/refresh";

/**
 * Mirrors REFRESH_TOKEN_EXPIRE_DAYS in the API's config.
 *
 * The API returns `expires_in` for the access token but says nothing about the
 * refresh token's lifetime, so this is the one number the two apps state
 * separately. Drift is harmless in both directions: a cookie that dies early
 * costs a sign-in, and one that outlives its token is spent on a refresh call
 * that 401s and redirects to the login screen anyway.
 */
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type SessionCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
};

function options(maxAge: number): SessionCookie["options"] {
  return {
    // The point of the whole arrangement: no script on any page can read these.
    httpOnly: true,
    // Not in development, where the dev server is plain http and a Secure
    // cookie would simply never be stored — sign-in would appear to succeed and
    // then bounce straight back to the login screen.
    secure: process.env.NODE_ENV === "production",
    // Lax, not Strict. Strict withholds the cookie on a top-level navigation
    // that came from another site, so following a link to /admin from anywhere
    // — including the sign-in redirect — would land on the login screen with a
    // perfectly good session sitting in the jar.
    //
    // Lax is enough against cross-site writes here: it withholds the cookie on
    // cross-site POST, and every mutation goes through a Server Action, which
    // Next guards with its own Origin check.
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

/**
 * The pair to set after a successful login or refresh.
 *
 * Each cookie's lifetime matches its token's. That is deliberate rather than
 * tidy: it means the browser drops the access cookie at the moment the token
 * stops working, so "no access cookie but a refresh cookie" is a reliable
 * signal that it is time to renew — and the console can skip the renewal check
 * entirely while the session is live, instead of asking the API on every page
 * load.
 */
export function sessionCookies(tokens: TokenPair): SessionCookie[] {
  return [
    {
      name: ACCESS_COOKIE,
      value: tokens.access_token,
      options: options(tokens.expires_in),
    },
    {
      name: REFRESH_COOKIE,
      value: tokens.refresh_token,
      options: options(REFRESH_MAX_AGE_SECONDS),
    },
  ];
}

/**
 * The pair to set when tearing a session down.
 *
 * maxAge 0 rather than a delete, so this can be applied to a redirect response
 * the same way sessionCookies() is, through one code path.
 */
export function clearedSessionCookies(): SessionCookie[] {
  return [ACCESS_COOKIE, REFRESH_COOKIE].map((name) => ({
    name,
    value: "",
    options: options(0),
  }));
}

/**
 * When the access token expires, for display only.
 *
 * Reads the `exp` claim without checking the signature, which would normally be
 * the bug in this kind of function. It is not one here because nothing is
 * decided on the result: it is rendered as a time in the console's status strip
 * so the admin knows when they will be asked to sign in again. Whether the
 * token is actually valid is settled by the API on every single call, against
 * its own key and its own token table.
 *
 * Returns null on anything unexpected rather than throwing — a status strip is
 * not worth a 500.
 */
export function accessTokenExpiry(token: string): Date | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const json = Buffer.from(payload, "base64url").toString("utf8");
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;

    if (typeof exp !== "number" || !Number.isFinite(exp)) return null;

    return new Date(exp * 1000);
  } catch {
    return null;
  }
}

/**
 * Sanitises the `next` parameter carried through sign-in and refresh.
 *
 * Both flows end in a redirect to a path taken from the query string, which is
 * an open redirect unless the value is checked — a link to
 * `/login?next=https://evil.example` that ends up on the attacker's page having
 * passed through this site's domain is a credible phishing step.
 *
 * ## Why this now allows any path on this site
 *
 * It used to allow only paths under /admin, on the argument that the console was
 * the only place either flow had business returning to. That stopped being true
 * when readers got accounts: the commonest sign-in on this site is now somebody
 * halfway down an article who has met the login gate, and the one thing that
 * must happen afterwards is that they land back on the paragraph they were
 * reading.
 *
 * What made the old rule safe is not the /admin prefix — it is the three checks
 * below, which are what actually keep the redirect on this origin. The prefix
 * was a fourth, narrower fence inside them. Removing it widens where a *local*
 * redirect may point and does not widen anything else.
 *
 * `fallback` is where a missing or rejected value goes, and it is the caller's
 * decision rather than a constant: the refresh route is renewing a console
 * session and wants /admin, while a reader signing in wants the site.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = ADMIN_PATH,
): string {
  if (typeof value !== "string" || value === "") return fallback;

  // `//evil.example` and `/\evil.example` are both read as protocol-relative
  // URLs — the second because browsers normalise a backslash to a forward
  // slash — so both leave the site while passing a naive "starts with /" test.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }

  // A newline or NUL on its way into a Location header is a response-splitting
  // attempt, and neither belongs in a path regardless. Ordinary spaces go the
  // same way: a URL has none, so one is either an encoding mistake or an
  // attempt at something, and neither is worth forwarding.
  if ([...value].some((ch) => /\s/.test(ch) || ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) {
    return fallback;
  }

  return value;
}

/** Whether a sanitised path leads into the console rather than the site. */
export function isAdminPath(path: string): boolean {
  // The path alone, so /admin?unread=1 counts and /admin-ish does not.
  const [pathname] = path.split(/[?#]/);
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
}


/**
 * Where a signed-in caller belongs, given where they asked to go.
 *
 * ## Why this is one function and not two conditions
 *
 * Because it is asked in two places — by the sign-in action once the token is
 * in hand, and by the sign-in screen when somebody who is already signed in
 * opens it — and the two must agree. When they did not, the disagreement was an
 * infinite redirect: a reader who opened /admin was bounced to
 * `/login?next=/admin`, the screen saw a live session and sent them to `next`,
 * which bounced them again. The browser gave up with ERR_TOO_MANY_REDIRECTS.
 *
 * ## The rule
 *
 * Honour what they asked for, with one exception: a non-admin asking for the
 * console cannot have it, and sending them back to the sign-in form to be told
 * so reads as a broken sign-in — the password was right and the session is
 * live. They go to the site.
 *
 * With nothing asked for, the owner wants the console and a reader wants the
 * site.
 *
 * `asked` must already have been through `safeNextPath`; this decides between
 * destinations, it does not make one safe.
 */
export function landingPath(asked: string, isAdmin: boolean): string {
  if (asked) return isAdmin || !isAdminPath(asked) ? asked : SITE_PATH;
  return isAdmin ? ADMIN_PATH : SITE_PATH;
}
