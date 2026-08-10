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
 * Allowing only paths under /admin rather than any local path, because that is
 * the only place either flow has business returning to.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (typeof value !== "string") return ADMIN_PATH;

  // `//evil.example` and `/\evil.example` are both read as protocol-relative
  // URLs — the second because browsers normalise a backslash to a forward
  // slash — so both leave the site while passing a naive "starts with /" test.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return ADMIN_PATH;
  }

  // A newline or NUL on its way into a Location header is a response-splitting
  // attempt, and neither belongs in a path regardless.
  if ([...value].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) {
    return ADMIN_PATH;
  }

  // Compare the path alone, so /admin?unread=1 survives the round trip rather
  // than being quietly downgraded to /admin.
  const path = value.split(/[?#]/)[0];
  if (path !== ADMIN_PATH && !path.startsWith(`${ADMIN_PATH}/`)) {
    return ADMIN_PATH;
  }

  return value;
}
