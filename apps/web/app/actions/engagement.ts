"use server";

import {
  type CommentState,
  readCommentForm,
  validateComment,
} from "@/lib/comment-form";
import type { ReactNode } from "react";

import {
  readProgress,
  readRating,
  readReadingList,
  readWholePost,
  saveProgress,
  submitComment,
  submitRating,
} from "@/lib/engagement";
import type { Heading } from "@/lib/headings";
import { renderPostBody } from "@/lib/mdx";
import type { RatingSummary, ReadingProgress } from "@/lib/types";

/**
 * The three things a reader can write: a comment, a star rating, and how far
 * through a post they have got.
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
 *
 * And nothing that decides who it is from. The identity comes from the session
 * cookie, read on the server by lib/engagement.ts and spent as a bearer token;
 * the API's request schema has no field for a name or an address at all. A
 * caller who posts to this action directly can choose their words and nothing
 * else about the row that results.
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
    body: values.body,
    ...(parentId === null ? {} : { parent_id: parentId }),
  });

  if (result.ok) return { status: "queued" };

  if (result.reason === "unauthorised") {
    // Nothing about what was typed is wrong, so the words are kept and the
    // form offers the way through instead of an error on a field.
    return {
      status: "unauthorised",
      needsVerification: result.needsVerification,
      message: result.message,
      values,
    };
  }

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


/**
 * Record how far through a post the signed-in reader has got.
 *
 * ## Why it answers with nothing
 *
 * Because there is nothing the caller can do with an answer. This is fired by a
 * scroll listener; a reader who is three paragraphs further on by the time it
 * returns has no use for a confirmation, and an error state on a progress bar
 * is a worse experience than a progress bar that is briefly out of date. A
 * failed write is dropped and the next scroll writes again.
 *
 * The other half of this arrangement lives in the recorder, which throttles —
 * see components/blog/read-recorder.tsx. Every guard that matters is on the
 * API: the account comes from the token, so this cannot be used to write
 * somebody else's progress whatever it is called with.
 *
 * ## What is checked here anyway
 *
 * The number. A Server Action is a POST endpoint the browser can reach
 * directly, so the range is enforced rather than trusted — the API enforces it
 * too, and this is what keeps a nonsense value a no-op instead of a 422 nothing
 * is listening for.
 */
export async function recordReadingProgress(
  postId: number,
  progress: number,
  finished?: boolean,
): Promise<void> {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) return;

  await saveProgress(postId, progress, finished);
}


/**
 * This reader's stored position in a post, or null.
 *
 * Called from the browser after the page has loaded rather than by the page
 * itself, for the reason `readPostRating` above gives at length: the answer
 * depends on a cookie, and reading one during render opts the whole route out
 * of static rendering — every post on this site, to answer a question most
 * visitors answer "nobody".
 *
 * Null covers signed out, never opened and API-not-answering alike. The control
 * treats all three the same because there is nothing else it could do: they all
 * mean there is no position to show.
 */
export async function readMyProgress(postId: number): Promise<ReadingProgress | null> {
  return readProgress(postId);
}


/**
 * Everything this reader has open, most recently read first.
 *
 * Empty for a signed-out caller, which is what makes it safe to call from the
 * index's panel without asking first: the answer is derived from the session
 * cookie and from nothing the caller sends.
 */
export async function readMyReading(): Promise<ReadingProgress[]> {
  return readReadingList();
}


/** A gated post, opened. Null when the caller may not have it. */
export type UnlockedPost = { content: ReactNode; headings: Heading[] } | null;

/**
 * The whole of a gated post, for the reader who has signed in.
 *
 * ## Why this exists
 *
 * Every page on this site is prerendered, and the gate is enforced by the API —
 * an anonymous request for a long post comes back cut, so the HTML built at
 * deploy time holds the opening and nothing else. That is the right way round:
 * the rest is *absent*, not covered, and no amount of View Source finds it.
 *
 * It leaves one gap. A reader who meets the gate, signs in and is sent back
 * arrives at the same prerendered page, correctly cut, because it was built for
 * nobody in particular. Making the page read the session instead would fix that
 * by taking the entire public blog dynamic to answer a question that is
 * "nobody" for most of its traffic.
 *
 * So the page stays static and the rest is fetched once, by the one reader it
 * belongs to, through here. Same arrangement as the star rating.
 *
 * ## Why it returns React and not HTML
 *
 * Because a Server Action can. The first version of this was a route handler
 * returning a string, which meant `renderToStaticMarkup` — and Next refuses
 * `react-dom/server` in the app directory, for good reason: it is a second
 * renderer with its own idea of what a component is, running beside the real
 * one.
 *
 * Returning the node instead is both simpler and the only version that is
 * correct for MDX, whose whole point is that a post body can contain real
 * components. Serialising those to markup would flatten them at exactly the
 * moment the reader finally gets to see them.
 *
 * ## What is checked, and where
 *
 * The API, on the token. This reads the session cookie server-side and spends
 * it; a caller with no session gets null because the API refuses them, not
 * because of anything decided here. There is no parameter that could name
 * another reader.
 */
export async function unlockPost(slug: string): Promise<UnlockedPost> {
  const post = await readWholePost(slug);
  if (!post) return null;

  const rendered = await renderPostBody(post.body, post.format);
  return { content: rendered.content, headings: rendered.headings };
}
