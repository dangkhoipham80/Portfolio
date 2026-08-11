"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { CONTENT_TAGS, type ContentTag } from "@/lib/api";
import {
  type ContentState,
  type EntitySpec,
  entityFor,
  readForm,
  toPayload,
  validate,
} from "@/lib/content-schema";
import { createContent, deleteContent, updateContent } from "@/lib/console-api";

/**
 * Writes for every content type, driven by lib/content-schema.ts.
 *
 * ## The entity comes from the description, never from the request
 *
 * Each action is given an entity key and looks it up in `ENTITIES`. An
 * unrecognised key is a 404, not a request forwarded to a path someone typed —
 * without that, `apiPath` would be attacker-controlled and these functions
 * would proxy arbitrary calls to the API using the admin's own token.
 *
 * ## Why the public site is revalidated and the console is not
 *
 * lib/api.ts holds public reads for five minutes, so a project edited here
 * would keep showing its old text on the home page for that long — the one
 * place where "it saved but the site disagrees" is visible to a stranger.
 * Every write busts the pages its type appears on. The console itself needs
 * nothing: lib/console-api.ts reads `no-store` throughout.
 *
 * ## Why each action re-checks the session
 *
 * `requireAdmin` runs in the layout, but a layout does not guard a Server
 * Action — the action is a POST endpoint the browser can reach directly.
 */

function specOrNotFound(entityKey: string): EntitySpec {
  const spec = entityFor(entityKey);
  if (!spec) {
    // Reached only if a caller invents a key; the screens pass one from ENTITIES.
    throw new Error(`Unknown content type: ${entityKey}`);
  }
  return spec;
}

/**
 * Drop every public page that read this type.
 *
 * By tag, not by path, and that is a correctness point rather than a tidy one.
 * `revalidatePath` was the first attempt: it cleared `/blog`, and did *not*
 * clear the prerendered `/blog/[slug]` pages even when called with the route
 * pattern and `"page"`. Unpublishing a post therefore removed it from the index
 * while leaving the post itself readable at its own URL, body and all, with the
 * API correctly 404ing underneath. Found by opening the URL after clicking
 * Unpublish; nothing in the type system or the test suite was ever going to say
 * so.
 *
 * A tag also survives the thing paths cannot: this action knows a row's id and
 * nothing else, so it could not have named the slug even if paths had worked.
 *
 * `updateTag`, not `revalidateTag`. In Next 16 the latter takes a cache-life
 * profile and marks the entry stale; the former is the Server Action form and
 * expires it immediately, which is what "I pressed Publish and then looked at
 * the site" requires. Getting this from memory would have produced the wrong
 * one — the signature is in node_modules/next/dist/server/web/spec-extension.
 */
function revalidatePublic(spec: EntitySpec): void {
  updateTag(tagFor(spec));
}

/** The spec's tag, checked against the ones lib/api.ts actually applies. */
function tagFor(spec: EntitySpec): ContentTag {
  const tag = CONTENT_TAGS[spec.cacheTag as keyof typeof CONTENT_TAGS];
  if (!tag) {
    // A spec whose tag matches nothing would revalidate nothing, silently —
    // the public site would just keep serving stale content after every edit.
    throw new Error(`No cache tag in lib/api.ts matches "${spec.cacheTag}"`);
  }
  return tag;
}

function listPath(spec: EntitySpec): string {
  return `/admin/${spec.key}`;
}

/**
 * Create or update, depending on `id`.
 *
 * Bound to its entity and row by the page that renders the form
 * (`saveContent.bind(null, key, id)`), so the form itself posts nothing that
 * decides what gets written.
 */
export async function saveContent(
  entityKey: string,
  id: number | null,
  _previous: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const spec = specOrNotFound(entityKey);
  const { accessToken } = await requireAdmin(listPath(spec));
  const mode = id === null ? "create" : "edit";

  const values = readForm(spec, formData, mode);

  // The browser ran this too. It runs again because the browser's copy is a
  // convenience, not a control — this form posts fine with scripting off.
  const errors = validate(spec, values, mode);
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors, values };
  }

  const payload = toPayload(spec, values, mode);

  const result =
    id === null
      ? await createContent(accessToken, spec.apiPath, payload)
      : await updateContent(accessToken, spec.apiPath, id, payload);

  if (!result.ok) {
    // A 404 on an edit means the row was deleted while this form sat open —
    // worth saying, because "the API did not answer" would send the admin
    // looking for an outage that is not there.
    if (result.reason === "missing") return { status: "missing", values };
    return { status: "unavailable", values };
  }

  revalidatePublic(spec);
  redirect(listPath(spec));
}

/** Flip `published`. Sends only that field; the rest of the row is not touched. */
export async function togglePublished(entityKey: string, formData: FormData): Promise<void> {
  const spec = specOrNotFound(entityKey);
  const { accessToken } = await requireAdmin(listPath(spec));

  const id = readId(formData);
  if (id === null) redirect(`${listPath(spec)}?problem=unknown-row`);

  const published = formData.get("published") === "true";
  const result = await updateContent(accessToken, spec.apiPath, id, { published });

  if (!result.ok) {
    redirect(`${listPath(spec)}?problem=${problemFor(result.reason, "not-published")}`);
  }

  revalidatePublic(spec);
  redirect(listPath(spec));
}

export async function removeContent(entityKey: string, formData: FormData): Promise<void> {
  const spec = specOrNotFound(entityKey);
  const { accessToken } = await requireAdmin(listPath(spec));

  const id = readId(formData);
  if (id === null) redirect(`${listPath(spec)}?problem=unknown-row`);

  const result = await deleteContent(accessToken, spec.apiPath, id);

  if (!result.ok) {
    redirect(`${listPath(spec)}?problem=${problemFor(result.reason, "not-deleted")}`);
  }

  revalidatePublic(spec);
  redirect(listPath(spec));
}

/*
 * There is deliberately no `loadContent` action. Reading a row for the edit
 * form is something the page does on the server anyway, and exporting it from
 * here would turn a plain function call into a POST endpoint the browser can
 * reach — admin-guarded, so not a hole, but surface with nothing to gain.
 */

/** Reject anything that is not a plain positive integer before it reaches a URL. */
function readId(formData: FormData): number | null {
  const id = Number(formData.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function problemFor(
  reason: "unauthorized" | "rate_limited" | "missing" | "error",
  whenFailed: string,
): string {
  if (reason === "unauthorized") return "session-ended";
  // Not a fault: the row was deleted from another tab, which is ordinary.
  if (reason === "missing") return "already-gone";
  return whenFailed;
}
