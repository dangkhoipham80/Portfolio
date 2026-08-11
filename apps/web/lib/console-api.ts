import "server-only";

import type { Contact, TokenPair } from "./types";

/**
 * Every call the console makes to the API.
 *
 * Separate from lib/api.ts on purpose. That module is the public site's reader:
 * GET, cached for five minutes, and every failure swallowed into a fallback so
 * a sleeping backend cannot take the portfolio down. All three are wrong here.
 *
 * - Caching a response that depends on an Authorization header risks serving
 *   one caller's data to another; the console reads `no-store` throughout.
 * - Swallowing failure would render an expired session as an empty inbox, which
 *   is the same picture as "no one has written to you" and reads as working.
 *   These return a discriminated result the caller has to look at.
 *
 * The one thing both share is that the browser never sees API_URL. The token is
 * read from an httpOnly cookie on the server and spent here.
 */

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

/** Sign-in is a person waiting on a button; a hung API must not hold them. */
const TIMEOUT_MS = 8000;

/** Outcomes the console distinguishes. Anything else is `error`. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unauthorized" }
  | { ok: false; reason: "rate_limited"; response: Response }
  /**
   * The row is not there. Distinguished from `error` because it is the one
   * failure with a specific, common and completely benign cause — the thing was
   * deleted since the page rendered — and collapsing it into "the API did not
   * answer" makes the console report an outage that did not happen.
   */
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "error" };

async function call(
  path: string,
  init: RequestInit & { token?: string },
): Promise<Response | null> {
  const { token, ...rest } = init;
  const url = `${API_URL}/api/v1${path}`;

  try {
    return await fetch(url, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...rest.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    // DNS failure, connection refused, or the timeout above.
    console.error(`[console] ${rest.method ?? "GET"} ${url} failed:`, error);
    return null;
  }
}

async function toResult<T>(response: Response | null, url: string): Promise<ApiResult<T>> {
  if (!response) return { ok: false, reason: "error" };

  // 403 as well as 401: require_admin answers 403 to a valid token belonging to
  // a non-admin, and from the console's side both mean "this session cannot do
  // this", which resolves the same way — back to the sign-in screen.
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "unauthorized" };
  }

  if (response.status === 429) return { ok: false, reason: "rate_limited", response };

  // Not logged: a 404 on a write means the row went away, which is an ordinary
  // race between two tabs rather than something wrong with the system.
  if (response.status === 404) return { ok: false, reason: "missing" };

  if (!response.ok) {
    console.error(`[console] ${response.status} ${response.statusText} from ${url}`);
    return { ok: false, reason: "error" };
  }

  const data = await response.json().catch(() => null);
  if (data === null) {
    console.error(`[console] ${url} returned a body that is not JSON`);
    return { ok: false, reason: "error" };
  }

  return { ok: true, data: data as T };
}

/** Exchange credentials for a token pair. */
export async function login(
  email: string,
  password: string,
  forwardedFor?: string,
): Promise<ApiResult<TokenPair>> {
  const response = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    // Forwarded so the API's per-IP login limit counts the person at the
    // keyboard rather than this server. Without it every sign-in attempt from
    // anywhere shares one ten-attempt bucket. The API only trusts the header in
    // production, which is the safe direction.
    headers: forwardedFor ? { "X-Forwarded-For": forwardedFor } : {},
  });

  return toResult<TokenPair>(response, "/auth/login");
}

/** Trade a refresh token for a new pair. The old one is revoked API-side. */
export async function refreshSession(refreshToken: string): Promise<ApiResult<TokenPair>> {
  const response = await call("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  return toResult<TokenPair>(response, "/auth/refresh");
}

/**
 * Revoke both tokens server-side.
 *
 * The API keeps a token table and checks it on every authenticated request, so
 * this is what makes signing out real. Clearing the cookies alone would leave a
 * token that still works for anyone who captured it — for the rest of its hour,
 * and thirty days for the refresh token.
 */
export async function logout(accessToken: string, refreshToken?: string): Promise<void> {
  await call("/auth/logout", {
    method: "POST",
    body: JSON.stringify({
      access_token: accessToken,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    }),
  });
}

export type CurrentUser = {
  id: number;
  email: string;
  full_name: string | null;
  roles: string[];
};

/** Who the access token belongs to. The console's real authorisation check. */
export async function fetchCurrentUser(token: string): Promise<ApiResult<CurrentUser>> {
  const response = await call("/auth/me", { token });
  return toResult<CurrentUser>(response, "/auth/me");
}

/** Contact messages, newest first. Admin-only on the API. */
export async function fetchContacts(token: string): Promise<ApiResult<Contact[]>> {
  const response = await call("/contacts/", { token });
  const result = await toResult<Contact[]>(response, "/contacts/");

  // Same reasoning as the shape checks in lib/api.ts: a gateway or tunnel can
  // answer 200 with JSON that is not what the API would have sent, and an
  // object where a list belongs throws on .map() during render — a 500 caused
  // by a successful request.
  if (result.ok && !Array.isArray(result.data)) {
    console.error("[console] /contacts/ returned 200 with a non-list body");
    return { ok: false, reason: "error" };
  }

  return result;
}

/**
 * Mark a message read.
 *
 * One-way, because the API is: it exposes `PUT /contacts/{id}/read` and nothing
 * that clears the flag. That is the right shape — the flag records having seen
 * a message, and there is no version of "I have not seen this" that becomes
 * true again afterwards.
 */
export async function markContactRead(
  token: string,
  id: number,
): Promise<ApiResult<Contact>> {
  const path = `/contacts/${id}/read`;
  const response = await call(path, { method: "PUT", token });
  return toResult<Contact>(response, path);
}

/** Delete a message. There is no soft delete on the API; the row goes. */
export async function deleteContact(token: string, id: number): Promise<ApiResult<unknown>> {
  const path = `/contacts/${id}`;
  const response = await call(path, { method: "DELETE", token });
  return toResult<unknown>(response, path);
}
