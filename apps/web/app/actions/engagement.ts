"use server";

import {
  type CommentState,
  readCommentForm,
  validateComment,
} from "@/lib/comment-form";
import { readRating, submitComment, submitRating } from "@/lib/engagement";
import type { RatingSummary } from "@/lib/types";

/**
 * The two things a reader can write: a comment, and a star rating.
 *
 * Server Actions rather than route handlers, for the reasons
 * app/actions/contact.ts sets out and which apply unchanged here — `API_URL`
 * stays on the server, CORS never enters the picture, and the comment form
 * posts without JavaScript.
 *
 * The visitor's own address and user agent are forwarded by lib/engagement.ts,
 * not here. That matters more than it looks: the API works out who a visitor is
 * from whoever called it, and because the browser never reaches the API
 * directly, without forwarding every reader in the world would be one voter
 * with one vote and one rate-limit bucket.
 *
 * `CommentState` and `INITIAL_COMMENT_STATE` live in lib/comment-form.ts rather
 * than here: a `"use server"` module may only export async functions, and
 * exporting the initial-state object from this file type-checks, builds, and
 * then throws on the first submission.
 */

/**
 * Post a comment. Bound to its post by the page that renders the form
 * (`submitPostComment.bind(null, post.id, parentId)`), so the form itself posts
 * nothing that decides where the comment lands.
 */
export async function submitPostComment(
  postId: number,
  parentId: number | null,
  _previous: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const values = readCommentForm(formData);

  // The browser ran this too. It runs again because the browser's copy is a
  // convenience, not a control — this form posts fine with scripting off.
  const errors = validateComment(values);
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors, values };
  }

  const result = await submitComment(postId, {
    ...values,
    ...(parentId === null ? {} : { parent_id: parentId }),
  });

  if (result.ok) return { status: "queued" };

  if (result.reason === "rejected") {
    return { status: "rejected", message: result.message, values };
  }
  if (result.reason === "rate_limited") {
    return { status: "rate_limited", retryAfter: result.retryAfter, values };
  }

  // Nothing was saved, and the reader has to be told — the opposite of the
  // read path, where a failure is swallowed so the page still renders.
  return { status: "unavailable", values };
}

/** What the star control gets back. Null means the vote did not go through. */
export type RatingState = { summary: RatingSummary | null; failed: boolean };

/**
 * This visitor's view of a post's rating.
 *
 * Called from the browser after the page has loaded, rather than by the page
 * itself, and that is a rendering decision rather than a stylistic one. The
 * summary carries `mine` — this visitor's own vote — which means resolving it
 * needs their headers, and reading headers during render opts the whole route
 * into per-request rendering. Every post on the site stopped being prerendered
 * the moment the page awaited this; the build output is where that showed up.
 *
 * So the page is static and the stars fill in a moment later. They are a
 * decoration on someone else's writing: the correct thing for them to cost is
 * nothing until the article is already on screen.
 */
export async function readPostRating(postId: number): Promise<RatingSummary> {
  return readRating(postId);
}

/**
 * Record a rating.
 *
 * Returns the whole summary rather than an acknowledgement, because the control
 * has to redraw with the new average and count — and the server has just
 * computed both. Asking for them in a second request would show the reader
 * their own vote missing for a moment.
 */
export async function ratePost(
  postId: number,
  stars: number,
): Promise<RatingState> {
  // The value comes from a click handler, but a Server Action is a POST
  // endpoint the browser can reach directly, so it is checked here rather than
  // trusted. The API checks it too; this is what keeps the failure a no-op
  // instead of a 422 the control cannot explain.
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { summary: null, failed: true };
  }

  const result = await submitRating(postId, stars);
  return result.ok
    ? { summary: result.data, failed: false }
    : { summary: null, failed: true };
}
