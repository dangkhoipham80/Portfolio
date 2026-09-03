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

/**
 * Ask the API to mail a reset link.
 *
 * Answers `ok` for an unknown address as readily as for a real one. That is the
 * API's design, not an oversight here — see request_password_reset in
 * apps/api/app/services/auth_service.py — and the console must not undo it by
 * inspecting the response for a difference that is deliberately not there.
 */
export async function requestPasswordReset(
  email: string,
  forwardedFor?: string,
): Promise<ApiResult<{ message: string }>> {
  const response = await call("/auth/password-reset-request", {
    method: "POST",
    body: JSON.stringify({ email }),
    // Same reason as login(): the API's cap is 5/hour per IP, and without this
    // header the IP it counts is this server's — so five requests from anywhere
    // in the world would lock the form for everybody.
    headers: forwardedFor ? { "X-Forwarded-For": forwardedFor } : {},
  });

  return toResult<{ message: string }>(response, "/auth/password-reset-request");
}

/**
 * Outcomes of spending a reset link. Not `ApiResult`, on purpose.
 *
 * The API answers 422 to two quite different things here — a token it will not
 * accept, and a password its schema rejects — and `toResult` folds every 422
 * into `error`, which would report both as "the API did not answer". They need
 * different sentences: one means ask for a new link, the other means choose a
 * longer password.
 *
 * The two are told apart by the shape of `detail`: FastAPI's own validation
 * failures carry a list, and the API's `ValidationError` carries a string.
 */
export type PasswordResetOutcome =
  | { ok: true }
  | { ok: false; reason: "token_rejected" }
  | { ok: false; reason: "weak_password" }
  | { ok: false; reason: "rate_limited"; response: Response }
  | { ok: false; reason: "error" };

/** Spend a reset link on a new password. Revokes every session the account had. */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<PasswordResetOutcome> {
  const path = "/auth/password-reset-confirm";
  const response = await call(path, {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });

  if (!response) return { ok: false, reason: "error" };

  if (response.ok) return { ok: true };

  if (response.status === 429) return { ok: false, reason: "rate_limited", response };

  if (response.status === 422) {
    const detail = (await response.json().catch(() => null))?.detail;
    // A list is pydantic rejecting `new_password`; the browser and the Server
    // Action both check the length first, so this is the case where the API's
    // rule is stricter than ours rather than the everyday one.
    return { ok: false, reason: Array.isArray(detail) ? "weak_password" : "token_rejected" };
  }

  console.error(`[console] ${response.status} ${response.statusText} from ${path}`);
  return { ok: false, reason: "error" };
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

/**
 * Content CRUD, for whichever type the caller names.
 *
 * One set of functions rather than five, because the API is one shape for all
 * of them — see lib/content-schema.ts, which holds the differences. `apiPath`
 * comes from that description and never from a URL, so a request cannot be
 * aimed somewhere else by editing the address bar.
 *
 * These return rows untyped. The admin screens render from the field
 * description rather than from a TypeScript interface, and the reader that does
 * care about shape — the public site's lib/api.ts — has its own.
 */
export type ContentRecord = Record<string, unknown>;

/**
 * Every row, drafts included.
 *
 * The token is what does that: `get_optional_admin` on the API widens the same
 * public list route to unpublished rows when the caller is an admin — which is
 * also why an admin list must never be cached. See the note at the top.
 */
export async function fetchContentList(
  token: string,
  apiPath: string,
): Promise<ApiResult<ContentRecord[]>> {
  const response = await call(apiPath, { token });
  const result = await toResult<ContentRecord[]>(response, apiPath);

  // Same reasoning as fetchContacts: an object where a list belongs throws on
  // .map() during render, which is a 500 produced by a successful request.
  if (result.ok && !Array.isArray(result.data)) {
    console.error(`[console] ${apiPath} returned 200 with a non-list body`);
    return { ok: false, reason: "error" };
  }

  return result;
}

export async function fetchContentItem(
  token: string,
  apiPath: string,
  id: number,
): Promise<ApiResult<ContentRecord>> {
  const path = `${apiPath}${id}`;
  const response = await call(path, { token });
  return toResult<ContentRecord>(response, path);
}

export async function createContent(
  token: string,
  apiPath: string,
  payload: ContentRecord,
): Promise<ApiResult<ContentRecord>> {
  const response = await call(apiPath, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  return toResult<ContentRecord>(response, apiPath);
}

export async function updateContent(
  token: string,
  apiPath: string,
  id: number,
  payload: ContentRecord,
): Promise<ApiResult<ContentRecord>> {
  const path = `${apiPath}${id}`;
  const response = await call(path, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
  return toResult<ContentRecord>(response, path);
}

export async function deleteContent(
  token: string,
  apiPath: string,
  id: number,
): Promise<ApiResult<unknown>> {
  const path = `${apiPath}${id}`;
  const response = await call(path, { method: "DELETE", token });
  return toResult<unknown>(response, path);
}

/**
 * The image library.
 *
 * Admin-only on the API including the reads, unlike the content routes — an
 * asset index lists things that were uploaded and never used, so it is not
 * public the way a project is. See apps/api/app/api/v1/endpoints/media.py.
 */
export type MediaAsset = {
  id: number;
  url: string;
  pathname: string | null;
  alt: string | null;
  mime: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
};

export async function fetchMedia(
  token: string,
  options: { q?: string; limit?: number } = {},
): Promise<ApiResult<MediaAsset[]>> {
  const params = new URLSearchParams();
  if (options.q) params.set("q", options.q);
  if (options.limit) params.set("limit", String(options.limit));

  const path = `/media/${params.size > 0 ? `?${params}` : ""}`;
  const response = await call(path, { token });
  const result = await toResult<MediaAsset[]>(response, path);

  // Same reasoning as fetchContacts: an object where a list belongs throws on
  // .map() during render, which is a 500 produced by a successful request.
  if (result.ok && !Array.isArray(result.data)) {
    console.error(`[console] ${path} returned 200 with a non-list body`);
    return { ok: false, reason: "error" };
  }

  return result;
}

/** Record an upload that has already reached Blob. Idempotent on the URL. */
export async function registerMedia(
  token: string,
  asset: {
    url: string;
    pathname?: string;
    mime?: string;
    size_bytes?: number;
    width?: number;
    height?: number;
  },
): Promise<ApiResult<MediaAsset>> {
  const response = await call("/media/", {
    method: "POST",
    token,
    body: JSON.stringify(asset),
  });
  return toResult<MediaAsset>(response, "/media/");
}

/** Alt text is the only editable field; everything else describes the object. */
export async function updateMediaAlt(
  token: string,
  id: number,
  alt: string | null,
): Promise<ApiResult<MediaAsset>> {
  const path = `/media/${id}`;
  const response = await call(path, {
    method: "PATCH",
    token,
    body: JSON.stringify({ alt }),
  });
  return toResult<MediaAsset>(response, path);
}

/** Forget an asset. The object stays in Blob; anything using the URL keeps working. */
export async function deleteMedia(token: string, id: number): Promise<ApiResult<unknown>> {
  const path = `/media/${id}`;
  const response = await call(path, { method: "DELETE", token });
  return toResult<unknown>(response, path);
}

/**
 * Comment moderation.
 *
 * Its own functions rather than another entity in lib/content-schema.ts, and
 * that is a real difference rather than an omission: every type in that file is
 * a thing the owner *writes*, edited through one generic form. A comment is
 * something a stranger wrote, and the only edits are approve, reject and
 * delete — a form with fifteen fields would be the wrong shape for three
 * buttons, and would offer to edit words that are not the owner's.
 */
export type CommentRow = {
  id: number;
  post_id: number;
  parent_id: number | null;
  author_name: string;
  author_email: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  author_hash: string | null;
  post_slug: string | null;
  post_title: string | null;
  created_at: string;
};

export async function fetchComments(
  token: string,
  status?: "pending" | "approved" | "rejected",
): Promise<ApiResult<CommentRow[]>> {
  const path = status ? `/comments/?status=${status}` : "/comments/";
  const response = await call(path, { token });
  const result = await toResult<CommentRow[]>(response, path);

  // Same reasoning as fetchContentList: an object where a list belongs throws
  // on .map() during render, which is a 500 caused by a successful request.
  if (result.ok && !Array.isArray(result.data)) {
    console.error(`[console] ${path} returned 200 with a non-list body`);
    return { ok: false, reason: "error" };
  }

  return result;
}

export async function moderateComment(
  token: string,
  id: number,
  status: "approved" | "rejected",
): Promise<ApiResult<CommentRow>> {
  const path = `/comments/${id}`;
  const response = await call(path, {
    method: "PUT",
    token,
    body: JSON.stringify({ status }),
  });
  return toResult<CommentRow>(response, path);
}

export async function deleteComment(token: string, id: number): Promise<ApiResult<unknown>> {
  const path = `/comments/${id}`;
  const response = await call(path, { method: "DELETE", token });
  return toResult<unknown>(response, path);
}

/**
 * A post's revision history.
 *
 * Under /posts rather than being its own entity, because a revision is not
 * something anyone creates or edits — it is written by the API on every content
 * save, and the only action on one is to restore it.
 */
export type RevisionRow = {
  id: number;
  post_id: number;
  title: string;
  excerpt: string | null;
  body: string;
  format: "markdown" | "mdx";
  tag_slugs: string[];
  note: string | null;
  created_at: string;
};

export async function fetchRevisions(
  token: string,
  postId: number,
): Promise<ApiResult<RevisionRow[]>> {
  const path = `/posts/${postId}/revisions`;
  const response = await call(path, { token });
  const result = await toResult<RevisionRow[]>(response, path);

  if (result.ok && !Array.isArray(result.data)) {
    console.error(`[console] ${path} returned 200 with a non-list body`);
    return { ok: false, reason: "error" };
  }

  return result;
}

export async function restoreRevision(
  token: string,
  postId: number,
  revisionId: number,
): Promise<ApiResult<ContentRecord>> {
  const path = `/posts/${postId}/revisions/${revisionId}/restore`;
  const response = await call(path, { method: "POST", token });
  return toResult<ContentRecord>(response, path);
}
