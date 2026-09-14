/**
 * What a comment form holds, and what counts as a valid one.
 *
 * No imports, for the reason lib/contact.ts and lib/content-schema.ts both
 * record: this is used by the browser (the form) and by the server (the action
 * that receives it), so the two cannot disagree about what is acceptable.
 * Anything the browser enforces can be skipped by posting the form directly, so
 * the server runs the identical function.
 *
 * ## Why there is only one field left
 *
 * There were three: a name, an address and the comment. The first two are gone
 * because a comment is now signed by the account that posted it — the API takes
 * the name and the address from the bearer token and its request schema has no
 * field for either, so there is nothing for a form to collect. That is also why
 * an admin writing a comment from the public site is asked for neither: they
 * are signed in, so the identity is already known, and there is no second path
 * that would let one be typed.
 *
 * The maximum mirrors the API's. Being stricter here rejects values the API
 * would take; being looser hands the reader a 422 that could have been a
 * sentence under the field.
 */

export type CommentValues = {
  body: string;
};

export type CommentErrors = Partial<Record<keyof CommentValues, string>>;

export const EMPTY_COMMENT: CommentValues = { body: "" };

export function readCommentForm(formData: FormData): CommentValues {
  const raw = formData.get("body");
  return { body: typeof raw === "string" ? raw.trim() : "" };
}

export function validateComment(values: CommentValues): CommentErrors {
  const errors: CommentErrors = {};

  if (values.body.length < 2) {
    errors.body = "Write something first.";
  } else if (values.body.length > 4000) {
    errors.body = `That is ${values.body.length} characters. The limit is 4000.`;
  }

  return errors;
}

/**
 * What a submission can come back as.
 *
 * `queued` rather than `sent`: the comment exists and is waiting to be
 * approved, and telling someone it is published when it is not is the one thing
 * this state must not do.
 */
export type CommentState =
  | { status: "idle" }
  | { status: "queued" }
  | { status: "invalid"; errors: CommentErrors; values: CommentValues }
  /**
   * Signed out, or signed in on an address that has not been confirmed. Kept
   * apart because the remedies are different and only one of them is "sign in":
   * a reader whose address is unconfirmed can sign in all day and still not be
   * able to post.
   */
  | {
      status: "unauthorised";
      needsVerification: boolean;
      message: string;
      values: CommentValues;
    }
  /** The API refused it — its own sentence, which is written for a reader. */
  | { status: "rejected"; message: string; values: CommentValues }
  | { status: "rate_limited"; retryAfter: number | null; values: CommentValues }
  | { status: "unavailable"; values: CommentValues };

export const INITIAL_COMMENT_STATE: CommentState = { status: "idle" };
