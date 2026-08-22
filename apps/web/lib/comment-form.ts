/**
 * What a comment form holds, and what counts as a valid one.
 *
 * No imports, for the reason lib/contact.ts and lib/content-schema.ts both
 * record: this is used by the browser (the form) and by the server (the action
 * that receives it), so the two cannot disagree about what is acceptable.
 * Anything the browser enforces can be skipped by posting the form directly,
 * so the server runs the identical function.
 *
 * The maximums mirror the column widths in apps/api/app/models/portfolio.py.
 * Being stricter here rejects values the API would take; being looser hands the
 * reader a 422 that could have been a sentence under the field.
 */

export type CommentValues = {
  author_name: string;
  author_email: string;
  body: string;
};

export type CommentErrors = Partial<Record<keyof CommentValues, string>>;

export const EMPTY_COMMENT: CommentValues = {
  author_name: "",
  author_email: "",
  body: "",
};

export function readCommentForm(formData: FormData): CommentValues {
  const read = (key: string) => {
    const raw = formData.get(key);
    return typeof raw === "string" ? raw.trim() : "";
  };

  return {
    author_name: read("author_name"),
    author_email: read("author_email"),
    body: read("body"),
  };
}

/**
 * Deliberately loose on the address.
 *
 * The API validates it properly with `EmailStr`; repeating that here would mean
 * a second, worse email regex whose only effect is to reject addresses the API
 * would have accepted. This checks the shape a person can see is wrong — no
 * `@`, nothing after the dot — and lets the API be the authority on the rest.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateComment(values: CommentValues): CommentErrors {
  const errors: CommentErrors = {};

  if (!values.author_name) {
    errors.author_name = "Add a name so there is something to reply to.";
  } else if (values.author_name.length > 80) {
    errors.author_name = `That name is ${values.author_name.length} characters. Trim it to 80.`;
  }

  if (!values.author_email) {
    // Says why it is being asked for, because "why do you want my email" is the
    // reasonable first thought and the answer is not "for a mailing list".
    errors.author_email = "Add an email. It is never published — it is how you get a reply.";
  } else if (!LOOKS_LIKE_EMAIL.test(values.author_email)) {
    errors.author_email = "That does not look like an email address. Check it for a typo.";
  }

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
  /** The API refused it — its own sentence, which is written for a reader. */
  | { status: "rejected"; message: string; values: CommentValues }
  | { status: "rate_limited"; retryAfter: number | null; values: CommentValues }
  | { status: "unavailable"; values: CommentValues };

export const INITIAL_COMMENT_STATE: CommentState = { status: "idle" };
