/**
 * What the inbox's actions can report back, and how it is worded.
 *
 * Lives here rather than beside the Server Actions that produce it, for the
 * reason lib/contact.ts records: a `"use server"` module may only export async
 * functions, and a lookup table exported from one type-checks and builds
 * cleanly, then throws the first time the action is invoked.
 */

/** The inbox is the console's index; the actions redirect back to it. */
export const INBOX_PATH = "/admin";

export type InboxProblem =
  | "unknown-message"
  | "already-gone"
  | "not-marked"
  | "not-deleted"
  | "session-ended";

/**
 * Each line says what happened, what state the message is now in, and what to
 * do. The middle part is the one that matters: after a failed write the only
 * question is whether it half-happened, and "it is unchanged" answers it.
 *
 * `already-gone` is separate from the two below it because it is the likeliest
 * failure by far — a message deleted in another tab, or on a page left open —
 * and it is not a fault. Reporting it as "the API did not answer" would be both
 * alarming and untrue: the API answered, promptly, with a 404.
 */
const MESSAGES: Record<InboxProblem, string> = {
  "unknown-message":
    "That request did not name a message, so nothing changed. Reload and try again.",
  "already-gone":
    "That message had already been deleted, so nothing changed. The list below is current.",
  "not-marked":
    "That message was not marked as read — the API did not answer. It is unchanged; try again.",
  "not-deleted":
    "That message was not deleted — the API did not answer. It is still here; try again.",
  "session-ended":
    "Your session ended before that went through, so nothing changed. Sign in again to repeat it.",
};

/**
 * Turn a `?problem=` value into something to show, or null.
 *
 * Anything unrecognised returns null rather than being echoed: the value
 * arrives from the URL, so a visitor can put whatever they like in it, and a
 * page that renders it is a page that renders text chosen by whoever wrote the
 * link.
 */
export function inboxProblem(value: string | string[] | undefined): string | null {
  const key = Array.isArray(value) ? value[0] : value;
  return key && key in MESSAGES ? MESSAGES[key as InboxProblem] : null;
}
