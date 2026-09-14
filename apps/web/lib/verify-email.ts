/**
 * The states the verification screen can be in.
 *
 * Here rather than beside the action that produces them, for the reason
 * lib/sign-in.ts and lib/comment-form.ts both record: a `"use server"` module
 * may only export async functions. The *type* would be erased and survive;
 * `INITIAL_VERIFY_STATE` is a real object, and exporting it from the action file
 * fails the build with "a use server file can only export async functions,
 * found object" — which is exactly how this file came to exist.
 *
 * Deliberately not `server-only`: the client component imports it too.
 */

export type VerifyEmailState =
  | { status: "idle" }
  | { status: "done" }
  /**
   * Used already, or expired. Deliberately not told apart: the API answers the
   * same way to each, and guessing would mean telling somebody their link
   * expired when in fact they had confirmed and could simply sign in.
   */
  | { status: "token_rejected" }
  | { status: "unavailable" };

export const INITIAL_VERIFY_STATE: VerifyEmailState = { status: "idle" };

/** What the "send it again" control can report. */
export type ResendState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "rate_limited" }
  | { status: "unavailable" };

export const INITIAL_RESEND_STATE: ResendState = { status: "idle" };
