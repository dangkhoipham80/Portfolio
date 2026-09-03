/**
 * The two password-reset forms' rules and result shapes, shared by the browser
 * and the server.
 *
 * Same split, and for the same reason, as lib/sign-in.ts and lib/contact.ts: a
 * `"use server"` module may only export async functions, so the state types and
 * the initial-state objects cannot live beside the actions that produce them.
 * The types alone would be erased and survive; the objects are real values and
 * would throw on the first submission — and neither `tsc --noEmit` nor
 * `next build` catches it, because the module only fails when the action is
 * first invoked.
 *
 * Deliberately not `server-only`: the client components import it too, so the
 * two halves cannot word the same problem two different ways.
 */

/**
 * Mirrors MIN_PASSWORD_LENGTH in apps/api/app/core/constants.py.
 *
 * One of the few numbers the two apps have to state separately, and the drift
 * is only safe in one direction. Stricter here than the API would refuse a
 * password the API would have taken; looser hands someone a 422 on the round
 * trip that this form could have explained under the field, after they have
 * already typed it twice.
 *
 * Length only. No character-class rule — the API deliberately has none either,
 * and adding one on this side would reject passwords the account can hold.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * How long a reset link lasts, in the words the screens use.
 *
 * Mirrors PASSWORD_RESET_EXPIRE_MINUTES in the API. Stated as a phrase rather
 * than a number of minutes because both places that need it are sentences, and
 * "60 minutes" is not how anyone reads a deadline.
 */
export const RESET_LINK_LIFETIME = "one hour";

/* -------------------------------------------------------------------------
 * Asking for a link
 * ---------------------------------------------------------------------- */

export type ResetRequestErrors = { email?: string };

export type ResetRequestState =
  | { status: "idle" }
  /** Empty or malformed address, caught before a request goes out. */
  | { status: "invalid"; errors: ResetRequestErrors; email: string }
  /**
   * The API accepted the request.
   *
   * Deliberately *not* "we sent you a mail". The API answers the same 200 for a
   * registered address and an unknown one — see request_password_reset in
   * apps/api — so this state cannot honestly claim a mail was sent, and copy
   * that did would hand back the account-enumeration property the API spends
   * four branches protecting.
   */
  | { status: "sent"; email: string }
  /** 429. `retryAfterSeconds` is null if the header was absent. */
  | { status: "rate_limited"; retryAfterSeconds: number | null; email: string }
  /** API unreachable, timed out, or 5xx. No link is coming. */
  | { status: "unavailable"; email: string };

export const INITIAL_RESET_REQUEST_STATE: ResetRequestState = { status: "idle" };

/**
 * Good enough to catch a typo, not an attempt at RFC 5322 — the same regex and
 * the same reasoning as lib/contact.ts. The authoritative check is `EmailStr`
 * on the API.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateResetRequest(email: string): ResetRequestErrors {
  const value = email.trim();

  if (!value) return { email: "Enter the account's email address." };

  if (!LOOKS_LIKE_EMAIL.test(value)) {
    // Naming the specific defect beats "enter a valid email": the usual cause
    // is a missing @ or a truncated domain, and saying so removes the guessing.
    return {
      email: value.includes("@")
        ? "That email address needs a domain, like name@example.com."
        : "That email address is missing an @.",
    };
  }

  return {};
}

/** Reads the field out of a FormData, so a no-JS post parses the same way. */
export function readResetRequestForm(formData: FormData): string {
  const value = formData.get("email");
  return typeof value === "string" ? value : "";
}

/* -------------------------------------------------------------------------
 * Setting the new password
 * ---------------------------------------------------------------------- */

export type NewPasswordField = "password" | "confirm";

export type NewPasswordErrors = Partial<Record<NewPasswordField, string>>;

export type NewPasswordValues = Record<NewPasswordField, string>;

export type NewPasswordState =
  | { status: "idle" }
  /** Too short, or the two boxes disagree. Nothing has been sent. */
  | { status: "invalid"; errors: NewPasswordErrors }
  /** Changed. Every session the account had is now revoked, this one included. */
  | { status: "done" }
  /**
   * The API refused the token: expired, already spent, or never real.
   *
   * One state for all three. Which of them it was is not something the screen
   * can find out — the API answers them identically on purpose — and the fix is
   * the same in every case: ask for a new link.
   */
  | { status: "token_rejected" }
  /** 429 on the confirm route. */
  | { status: "rate_limited"; retryAfterSeconds: number | null }
  /** API unreachable, timed out, or 5xx. The password did not change. */
  | { status: "unavailable" };

export const INITIAL_NEW_PASSWORD_STATE: NewPasswordState = { status: "idle" };

/**
 * Length, and that the two boxes agree.
 *
 * The confirmation box exists because this is the one form on the site where
 * getting it wrong is expensive: the password is never echoed back, the reset
 * link is spent on submit, and the account is the only way into the console. A
 * typo would otherwise be discovered at the login screen with no way back.
 */
export function validateNewPassword(values: NewPasswordValues): NewPasswordErrors {
  const errors: NewPasswordErrors = {};

  if (!values.password) {
    errors.password = "Choose a new password.";
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    // Says how far off it is rather than restating the rule, which is the part
    // a counter above the field cannot convey once it has been submitted.
    const short = MIN_PASSWORD_LENGTH - values.password.length;
    errors.password = `${short} character${short === 1 ? "" : "s"} short — passwords are at least ${MIN_PASSWORD_LENGTH}.`;
  }

  if (!values.confirm) {
    errors.confirm = "Type the new password again.";
  } else if (values.password && values.confirm !== values.password) {
    errors.confirm = "These two do not match.";
  }

  return errors;
}

/** Reads both boxes out of a FormData, so a no-JS post parses the same way. */
export function readNewPasswordForm(formData: FormData): NewPasswordValues {
  const read = (field: NewPasswordField) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };

  // Never trimmed. Leading and trailing spaces may be part of a password, and
  // silently removing them here would set a password the person cannot type.
  return { password: read("password"), confirm: read("confirm") };
}

/**
 * The token out of the URL, or null.
 *
 * A reset link is pasted, forwarded and re-typed, so the value arriving here
 * is not always the one that was mailed. Anything that is not a plausible JWT
 * is treated as no token at all — the screen then says the link is incomplete
 * and offers a fresh one, rather than posting a guess and reporting the API's
 * refusal as though the account were the problem.
 */
export function readResetToken(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;

  const token = value.trim();
  if (!token) return null;

  // Three base64url segments. Not a signature check — that is the API's job,
  // against a key this app does not have — just a shape check, so a truncated
  // paste is caught before it costs a round trip.
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? token : null;
}
