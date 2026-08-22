"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { CONTENT_TAGS } from "@/lib/api";
import { restoreRevision } from "@/lib/console-api";

/**
 * Put a post back to an earlier version.
 *
 * The API snapshots the version being replaced before applying the restore, so
 * this is undoable by the same button — pressing it on the wrong row costs one
 * more click, not the current draft.
 *
 * The public pages are invalidated because the post's text has changed, and a
 * restore that leaves the site showing the version you just replaced is the one
 * outcome nobody would expect.
 */
export async function restorePostRevision(
  postId: number,
  formData: FormData,
): Promise<void> {
  const back = `/admin/posts/${postId}/history`;
  const { accessToken } = await requireAdmin(back);

  // From the form, so it is checked rather than trusted — the same rule the
  // rest of the console applies to anything that reaches a URL.
  const revisionId = Number(formData.get("revision_id"));
  if (!Number.isInteger(revisionId) || revisionId <= 0) {
    redirect(`${back}?problem=unknown-row`);
  }

  const result = await restoreRevision(accessToken, postId, revisionId);

  if (!result.ok) {
    if (result.reason === "missing") redirect(`${back}?problem=already-gone`);
    redirect(
      `${back}?problem=${result.reason === "unauthorized" ? "session-ended" : "not-restored"}`,
    );
  }

  updateTag(CONTENT_TAGS.posts);
  redirect(`/admin/posts/${postId}`);
}
