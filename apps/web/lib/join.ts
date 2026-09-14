/**
 * What the account form holds, and what counts as a valid one.
 *
 * Same split, and for the same reason, as lib/sign-in.ts and lib/comment-form.ts:
 * a `"use server"` module may only export async functions, so the state type and
 * the initial state object cannot live beside the action that produces them.
 * Deliberately not `server-only` — the client component imports it too, so the
 * two cannot word the same rule two different ways.
 *
 * Anything the browser enforces can be skipped by posting the form directly, so
 * the action runs the identical function, and the API runs its own on top of
 * that.
 */

export type JoinField = "full_name" | "email" | "password";

export const JOIN_FIELDS: JoinField[] = ["full_name", "email", "password"];

export type JoinValues = Record<JoinField, string>;

export type JoinErrors = Partial<Record<JoinField, string>>;

export const EMPTY_JOIN: JoinValues = { full_name: "", email: "", password: "" };

export type JoinState =
  | { status: "idle" }
  /**
   * The request went through. Not "your account was created" — the API answers
   * the same 202 for an address that already has one, so a screen claiming a new
   * account would give that back in the copy.
   */
  | { status: "sent"; email: string }
  | { status: "invalid"; errors: JoinErrors; values: JoinValues }
  | { status: "rate_limited"; retryAfterSeconds: number | null; values: JoinValues }
  | { status: "unavailable"; values: JoinValues };

export const INITIAL_JOIN_STATE: JoinState = { status: "idle" };

/**
 * Mirrors MIN_PASSWORD_LENGTH in apps/api/app/core/constants.py.
 *
 * Stated here so a short password is answered under the field instead of coming
 * back as a 422 the form cannot explain. The API is still the authority — if the
 * two ever disagree, the screen says so rather than reporting an outage.
 */
export const MIN_PASSWORD_LENGTH = 12;

/** The column width on `post_comments.author_name`, which is what signs a comment. */
const MAX_NAME_LENGTH = 80;

/**
 * Deliberately loose on the address, exactly as lib/comment-form.ts is.
 *
 * The API validates it properly; a second, worse email regex here would only
 * reject addresses the API would have accepted. This catches the shape a person
 * can see is wrong.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readJoinForm(formData: FormData): JoinValues {
  const read = (field: JoinField) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };

  // The password is read but never trimmed and never echoed back into the form:
  // spaces may be part of it, and a value the browser did not put there should
  // not come back down the wire in a re-render.
  return {
    full_name: read("full_name").trim(),
    email: read("email").trim(),
    password: read("password"),
  };
}

export function validateJoin(values: JoinValues): JoinErrors {
  const errors: JoinErrors = {};

  if (!values.full_name) {
    // Says what it is for. "Name" on a sign-up form usually means "for our
    // records"; here it is the name that will appear on a comment.
    errors.full_name = "Add a name. It is what your comments will be signed with.";
  } else if (values.full_name.length > MAX_NAME_LENGTH) {
    errors.full_name = `That name is ${values.full_name.length} characters. Trim it to ${MAX_NAME_LENGTH}.`;
  }

  if (!values.email) {
    errors.email = "Add an email address. You will get a link to confirm it.";
  } else if (!LOOKS_LIKE_EMAIL.test(values.email)) {
    errors.email = "That does not look like an email address. Check it for a typo.";
  }

  if (!values.password) {
    errors.password = "Choose a password.";
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    // The number, not "too short". Someone who has typed nine characters should
    // be able to see how many more to add.
    errors.password = `${MIN_PASSWORD_LENGTH} characters or more. That one is ${values.password.length}.`;
  }

  return errors;
}
