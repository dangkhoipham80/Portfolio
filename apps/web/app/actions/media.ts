"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-guard";
import { deleteMedia, registerMedia, updateMediaAlt } from "@/lib/console-api";

/**
 * Writes against the image library.
 *
 * ## Why registration is a Server Action and not part of the upload route
 *
 * `app/api/admin/upload/route.ts` mints the Blob token and never sees the
 * bytes; the browser uploads directly. Blob does offer a webhook —
 * `onUploadCompleted` — and recording the asset there is the obvious place, but
 * that callback fires from Blob *into the deployment*, so it never runs against
 * localhost. Registering there would build a feature that works in production
 * and silently no-ops in development, which is how you end up with an empty
 * library on your own machine and no idea why.
 *
 * So the browser reports the upload itself, through here, where the session
 * cookie can be exchanged for the API token it is not allowed to hold.
 *
 * ## Failure is deliberately quiet
 *
 * `register` returns a boolean and the caller ignores it. The upload has
 * already succeeded at this point and the URL is already in the form field —
 * the image will save and render whether or not this row gets written. Blocking
 * the admin on a bookkeeping call, or worse making the upload look failed when
 * the bytes are safely stored, would trade a real outcome for an index entry.
 * A missed registration costs one untracked asset.
 *
 * ## Why each action re-checks the session
 *
 * `requireAdmin` runs in the layout, but a layout does not guard a Server
 * Action — the action is a POST endpoint the browser can reach directly.
 */

export async function registerUpload(asset: {
  url: string;
  pathname?: string;
  mime?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
}): Promise<boolean> {
  const { accessToken } = await requireAdmin("/admin/media");
  const result = await registerMedia(accessToken, asset);

  if (!result.ok) {
    console.error("[console] failed to register an upload:", asset.url, result.reason);
  }

  return result.ok;
}

export async function saveAltText(id: number, formData: FormData): Promise<void> {
  const { accessToken } = await requireAdmin("/admin/media");

  const raw = String(formData.get("alt") ?? "").trim();
  // Empty means "no description", which is a real state and not the same as
  // leaving the field alone — the API's PATCH takes an explicit null for it.
  await updateMediaAlt(accessToken, id, raw === "" ? null : raw);

  revalidatePath("/admin/media");
}

/** Takes the id as a form field, so it can back a <ConfirmDelete> directly. */
export async function forgetAsset(formData: FormData): Promise<void> {
  const { accessToken } = await requireAdmin("/admin/media");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await deleteMedia(accessToken, id);
  revalidatePath("/admin/media");
}
