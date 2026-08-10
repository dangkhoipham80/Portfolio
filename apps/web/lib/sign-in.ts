/**
 * Sign-in form rules and result shape, shared by the browser and the server.
 *
 * Same split, and for the same reason, as lib/contact.ts: a `"use server"`
 * module may only export async functions, so the state type and the initial
 * state object cannot live beside the action that produces them. The type alone
 * would be erased and survive; INITIAL_SIGN_IN_STATE is a real object and would
 * throw on the first submission — and neither `tsc --noEmit` nor `next build`
 * catches it, because the module only fails when the action is first invoked.
 *
 * Deliberately not `server-only`: the client component imports it too, so the
 * two cannot word the same problem two different ways.
 */

export type SignInField = "email" | "password";

export const SIGN_IN_FIELDS: SignInField[] = ["email", "password"];

export type SignInValues = Record<SignInField, string>;

export type SignInErrors = Partial<Record<SignInField, string>>;

export type SignInState =
  | { status: "idle" }
  /** Empty fields, caught before a request goes out. */
  | { status: "invalid"; errors: SignInErrors; email: string }
  /** The API said no. Deliberately not which half was wrong. */
  | { status: "rejected"; email: string }
  /** 429. `retryAfterSeconds` is null if the header was absent. */
  | { status: "rate_limited"; retryAfterSeconds: number | null; email: string }
  /** API unreachable, timed out, or 5xx. Nothing to do with the credentials. */
  | { status: "unavailable"; email: string };

export const INITIAL_SIGN_IN_STATE: SignInState = { status: "idle" };

/**
 * Presence only.
 *
 * No length rule and no email-shape rule, unlike the contact form. Both fields
 * here are a claim about an existing account rather than new input, and the API
 * answers every bad credential with the same 401 on purpose — a client-side
 * "that is not long enough" would put back exactly the signal the API declines
 * to give, and would lock out a password that predates the current rule.
 *
 * What is left is worth doing: an empty submit gets an answer instantly instead
 * of spending one of ten rate-limited attempts to be told the same thing.
 */
export function validateSignIn(values: SignInValues): SignInErrors {
  const errors: SignInErrors = {};

  if (!values.email.trim()) errors.email = "Enter the account's email address.";
  if (!values.password) errors.password = "Enter the password.";

  return errors;
}

/** Reads the fields out of a FormData, so a no-JS post parses the same way. */
export function readSignInForm(formData: FormData): SignInValues {
  const read = (field: SignInField) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };

  // The password is read but never trimmed and never echoed back into the form:
  // leading or trailing spaces may be part of it, and a value the browser did
  // not put there should not come back down the wire in a re-render.
  return { email: read("email"), password: read("password") };
}
