"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { deleteContact, markContactRead } from "@/lib/console-api";
import { INBOX_PATH, type InboxProblem } from "@/lib/inbox";

/**
 * The inbox's two writes.
 *
 * ## Why there is no `revalidatePath`
 *
 * There is nothing to revalidate. lib/console-api.ts reads `no-store`
 * throughout — a response that depends on an Authorization header must not sit
 * in a shared cache — so the next render of /admin already fetches fresh. The
 * public site's readers are the ones behind a five-minute ISR window, and none
 * of them read contacts. A `revalidatePath` here would be a no-op that looked
 * load-bearing, which is worse than not having it; the CRUD screens for
 * published content will need one, and it will mean something there.
 *
 * ## Why the outcome travels in the URL
 *
 * These are plain `<form action={...}>` posts, so they work with scripting off,
 * and a bare Server Action has no way to hand anything back to a page rendered
 * that way. `useActionState` would, at the cost of making both controls client
 * components that do nothing until hydration. Redirecting with a `problem` code
 * keeps the whole path server-side, and the success case redirects too — to the
 * clean URL, so a failure notice cannot outlive the failure that caused it.
 *
 * ## Why each one re-checks the session
 *
 * `requireAdmin` runs in the layout, but a layout does not guard a Server
 * Action: the action is a POST endpoint the browser can reach directly, and it
 * has to establish for itself who is calling. The API would refuse an
 * unauthenticated write anyway — this is what turns that refusal into a sign-in
 * screen rather than an error.
 */

/** Reject anything that is not a plain positive integer before it reaches a URL. */
function readId(formData: FormData): number | null {
  const id = Number(formData.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function fail(problem: InboxProblem): never {
  redirect(`${INBOX_PATH}?problem=${problem}`);
}

/**
 * Which sentence a failed write earns.
 *
 * `missing` is the interesting one: a 404 here almost always means the message
 * was deleted from another tab, which is not a fault and must not be reported
 * as one. `whenFailed` is what is left — the API was reachable but refused, or
 * was not reachable at all.
 */
function problemFor(
  reason: "unauthorized" | "rate_limited" | "missing" | "error",
  whenFailed: InboxProblem,
): InboxProblem {
  if (reason === "unauthorized") return "session-ended";
  if (reason === "missing") return "already-gone";
  return whenFailed;
}

export async function markContactAsRead(formData: FormData): Promise<void> {
  const { accessToken } = await requireAdmin(INBOX_PATH);

  const id = readId(formData);
  if (id === null) fail("unknown-message");

  const result = await markContactRead(accessToken, id);
  if (!result.ok) fail(problemFor(result.reason, "not-marked"));

  redirect(INBOX_PATH);
}

export async function removeContact(formData: FormData): Promise<void> {
  const { accessToken } = await requireAdmin(INBOX_PATH);

  const id = readId(formData);
  if (id === null) fail("unknown-message");

  const result = await deleteContact(accessToken, id);
  if (!result.ok) fail(problemFor(result.reason, "not-deleted"));

  redirect(INBOX_PATH);
}
