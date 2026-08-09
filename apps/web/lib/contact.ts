/**
 * Contact form field rules, shared by the browser and the server.
 *
 * Deliberately not `server-only` and deliberately dependency-free: this module
 * is imported by both the client component and the Server Action, so the two
 * cannot disagree about what a valid message is or word the same problem two
 * different ways. Client-side checks are for turnaround — the Server Action
 * runs the identical function, because anything the browser enforces can be
 * skipped by posting the form directly.
 *
 * The maximums mirror ContactCreate in apps/api/app/schemas/portfolio.py, which
 * in turn mirrors the column widths. Being stricter here than the API would
 * reject messages the API accepts; being looser hands the visitor a server
 * error we could have explained in the field.
 */

/**
 * The address the form falls back to.
 *
 * One definition, because it appears in the channel list, the success card and
 * both failure notices — and an address that is right in three places and stale
 * in the fourth is worse than one that is wrong everywhere, because nobody
 * notices.
 */
export const OWNER_EMAIL = "dangkhoipham80@gmail.com";

export const CONTACT_LIMITS = {
  name: 100,
  email: 255,
  subject: 255,
  message: 5000,
} as const;

export type ContactField = keyof typeof CONTACT_LIMITS;

export const CONTACT_FIELDS: ContactField[] = ["name", "email", "subject", "message"];

export type ContactValues = Record<ContactField, string>;

export type ContactErrors = Partial<Record<ContactField, string>>;

/**
 * The result of a submission.
 *
 * Lives here rather than beside the Server Action that produces it, because a
 * `"use server"` module may only export async functions — Next throws
 * "A 'use server' file can only export async functions, found object" at
 * runtime for anything else. The type would have been erased and been fine;
 * INITIAL_CONTACT_STATE below is a real object and would not. Neither
 * `tsc --noEmit` nor `next build` catches it: the module evaluates, and fails,
 * only when the action is first invoked.
 */
export type ContactState =
  | { status: "idle" }
  | { status: "sent" }
  /** Field-level problems, plus what was typed so the form can be refilled. */
  | { status: "invalid"; errors: ContactErrors; values: ContactValues }
  /** 429 from the API. `retryAfterSeconds` is null if the header was absent. */
  | { status: "rate_limited"; retryAfterSeconds: number | null; values: ContactValues }
  /** API unreachable, timed out, or 5xx. The message was not delivered. */
  | { status: "unavailable"; values: ContactValues };

export const INITIAL_CONTACT_STATE: ContactState = { status: "idle" };

export const EMPTY_CONTACT: ContactValues = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

/**
 * Good enough to catch a typo, not an attempt at RFC 5322.
 *
 * The authoritative check is `EmailStr` on the API, which uses email-validator.
 * A regex that tries to be complete is famously wrong at the edges and would
 * reject valid addresses here that the server would have accepted — the worse
 * of the two failure modes, because the visitor cannot argue with it.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LABELS: Record<ContactField, string> = {
  name: "Name",
  email: "Email",
  subject: "Subject",
  message: "Message",
};

const MISSING: Record<ContactField, string> = {
  name: "Enter your name.",
  email: "Enter your email address.",
  subject: "Enter a subject.",
  message: "Write a message before sending.",
};

/**
 * Errors name the field and the fix. No apologies, and no "invalid input" —
 * that tells someone their input was rejected without telling them what to
 * change, which is the one thing they need.
 */
export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};

  for (const field of CONTACT_FIELDS) {
    const value = values[field].trim();
    const limit = CONTACT_LIMITS[field];

    if (!value) {
      // "Enter your subject" is not English — the subject is not something the
      // sender possesses, unlike their name and address.
      errors[field] = MISSING[field];
      continue;
    }

    if (value.length > limit) {
      errors[field] = `${LABELS[field]} is ${value.length} characters. Trim it to ${limit}.`;
      continue;
    }

    if (field === "email" && !LOOKS_LIKE_EMAIL.test(value)) {
      // Naming the specific defect beats "enter a valid email": the usual cause
      // is a missing @ or a truncated domain, and saying so removes the guessing.
      errors.email = value.includes("@")
        ? "That email address needs a domain, like name@example.com."
        : "That email address is missing an @.";
    }
  }

  return errors;
}

/** Reads the four fields out of a FormData, so a no-JS post parses the same way. */
export function readContactForm(formData: FormData): ContactValues {
  const read = (field: ContactField) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };

  return {
    name: read("name"),
    email: read("email"),
    subject: read("subject"),
    message: read("message"),
  };
}
