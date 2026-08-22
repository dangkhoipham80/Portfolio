"use server";

import { updateTag } from "next/cache";

import { requireAdmin } from "@/lib/admin-guard";
import { CONTENT_TAGS } from "@/lib/api";
import { createContent } from "@/lib/console-api";
import type { TagRef } from "@/lib/types";

/**
 * Create a tag without leaving the post you are writing.
 *
 * Separate from app/actions/content.ts, which is the generic create/update/
 * delete driven by lib/content-schema.ts. This one is not generic: it returns
 * the created row so the picker can select it immediately, where every action
 * in that file redirects. Bending the generic one to also return a value would
 * make its type a union that every other caller has to narrow for no reason.
 *
 * Tags remain a first-class content type with their own list and edit screens —
 * this is a shortcut, not the only way in.
 */

export type CreateTagResult =
  | { ok: true; tag: TagRef }
  | { ok: false; message: string };

export async function createTagInline(name: string): Promise<CreateTagResult> {
  const { accessToken } = await requireAdmin("/admin/posts");

  const trimmed = name.trim();
  // The browser checks this too. It is checked again because a Server Action is
  // a POST endpoint the browser can reach directly.
  if (!trimmed) return { ok: false, message: "Give the tag a name." };
  if (trimmed.length > 60) {
    return { ok: false, message: `That is ${trimmed.length} characters. Trim it to 60.` };
  }

  // No slug: the API derives one from the name, and suffixes it if taken.
  const result = await createContent(accessToken, "/tags/", { name: trimmed });

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "unauthorized"
          ? "Your session ended. Open the console in a new tab to sign in, then try again."
          : "The tag was not created — the API did not answer. Try again.",
    };
  }

  const created = result.data as { id?: number; slug?: string; name?: string };
  if (typeof created?.slug !== "string") {
    // A 200 with an unexpected body. Reported rather than assumed, so the
    // picker does not select a tag whose slug it invented.
    return { ok: false, message: "The tag was created but came back malformed. Reload." };
  }

  // The public index's facets read this list, so a new tag has to invalidate
  // them — otherwise the first post filed under it links to a page that says
  // there is nothing there for up to five minutes.
  updateTag(CONTENT_TAGS.blogTags);

  return {
    ok: true,
    tag: { id: created.id ?? 0, slug: created.slug, name: created.name ?? trimmed },
  };
}
