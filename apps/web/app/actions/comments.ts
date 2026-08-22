"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { CONTENT_TAGS } from "@/lib/api";
import { deleteComment, moderateComment } from "@/lib/console-api";

/**
 * Approve, reject or delete a comment.
 *
 * Plain form actions with no returned state, unlike the content form: these are
 * one-click decisions on a list, and the result is the list re-rendered with
 * the row moved. There is nothing to keep in a form because there is no form.
 *
 * Each one expires the `posts` tag, which is what makes an approval show up on
 * the public thread. By tag rather than by path because these actions know a
 * comment id and nothing else — not the post, not its slug, not its URL.
 *
 * Each action re-checks the session for the reason app/actions/content.ts
 * records: `requireAdmin` in the layout does not guard a Server Action, which
 * is a POST endpoint the browser can reach directly.
 */

const QUEUE = "/admin/comments";

/** Reject anything that is not a plain positive integer before it reaches a URL. */
function readId(formData: FormData): number | null {
  const id = Number(formData.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function setCommentStatus(formData: FormData): Promise<void> {
  const { accessToken } = await requireAdmin(QUEUE);

  const id = readId(formData);
  const status = formData.get("status");

  // The status comes from the form, so it is checked against the two values
  // this action is allowed to set rather than forwarded. "pending" is
  // deliberately not one of them: a comment arrives pending, and there is no
  // interface for putting one back.
  if (id === null || (status !== "approved" && status !== "rejected")) {
    redirect(`${QUEUE}?problem=unknown-row`);
  }

  const result = await moderateComment(accessToken, id, status);
  if (!result.ok) {
    redirect(`${QUEUE}?problem=${result.reason === "unauthorized" ? "session-ended" : "not-saved"}`);
  }

  updateTag(CONTENT_TAGS.posts);
  redirect(QUEUE);
}

export async function removeComment(formData: FormData): Promise<void> {
  const { accessToken } = await requireAdmin(QUEUE);

  const id = readId(formData);
  if (id === null) redirect(`${QUEUE}?problem=unknown-row`);

  const result = await deleteComment(accessToken, id);
  if (!result.ok) {
    // A 404 means it was deleted from another tab, which is ordinary rather
    // than a fault.
    if (result.reason === "missing") redirect(`${QUEUE}?problem=already-gone`);
    redirect(`${QUEUE}?problem=${result.reason === "unauthorized" ? "session-ended" : "not-deleted"}`);
  }

  updateTag(CONTENT_TAGS.posts);
  redirect(QUEUE);
}
