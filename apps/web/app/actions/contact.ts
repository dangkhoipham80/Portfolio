"use server";

import { headers } from "next/headers";

import {
  type ContactErrors,
  type ContactState,
  readContactForm,
  validateContact,
} from "@/lib/contact";
import { retryAfterSeconds } from "@/lib/retry-after";

/**
 * The contact form's write path.
 *
 * ## Why a Server Action and not a route handler
 *
 * Both keep `API_URL` on the server, which is the property lib/api.ts exists to
 * protect — the browser never learns where the API lives, and CORS never enters
 * the picture. The Server Action wins on two others:
 *
 * 1. `<form action={submitContact}>` posts without JavaScript. A route handler
 *    means a client `fetch`, which means the form is inert until hydration and
 *    dead if the bundle fails. This one degrades to a normal form POST.
 * 2. No hand-rolled contract. A route handler needs a request shape, a response
 *    shape, a JSON parse and error handling on both sides for what is one
 *    function call — roughly twice the code to arrive at the same place.
 *
 * ## Why it is not in lib/api.ts
 *
 * That module is `server-only` reads: GET, cached with `revalidate`, and every
 * failure swallowed into a fallback so a sleeping backend cannot 500 the page.
 * All three are wrong for a mutation. A POST must not be cached, must not be
 * retried by a framework that thinks it is idempotent, and above all must not
 * silently swallow failure — "your message went nowhere" is exactly the thing
 * the visitor has to be told. Same degradation *principle* as lib/api.ts, which
 * is that the site keeps working when the API does not; opposite mechanism,
 * because here that means reporting the failure instead of hiding it.
 */

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

/** A hung backend must not hang the submit button along with it. */
const TIMEOUT_MS = 8000;

/*
 * ContactState and INITIAL_CONTACT_STATE are defined in lib/contact.ts, not
 * here where they belong. A "use server" module may only export async
 * functions; exporting the initial-state object from this file builds and
 * type-checks cleanly, then throws on the first submission.
 */

/**
 * Forward the visitor's address so the API rate-limits the right person.
 *
 * The API's limit is 5/hour keyed on client IP. Because this POST is proxied by
 * the Next server, the address the API sees is the Next server's — so without
 * this every visitor in the world would share one five-message bucket and the
 * form would lock for everybody after five submissions total.
 *
 * `client_ip` in apps/api only trusts this header when the API is in
 * production, so locally the bucket stays shared. That is the safe direction:
 * an unproxied API that trusted the header would let a caller choose their own
 * rate-limit key by sending it.
 */
async function forwardedFor(): Promise<Record<string, string>> {
  const incoming = await headers();
  const forwarded = incoming.get("x-forwarded-for");

  return forwarded ? { "X-Forwarded-For": forwarded } : {};
}

/**
 * Map the API's 422 back onto a field.
 *
 * Should be rare — the same `validateContact` ran before the request went out —
 * but the API's `EmailStr` is stricter than the regex a form can reasonably
 * use, so a domain like `foo@bar..com` passes here and fails there. Better to
 * land that on the email field than to report it as an outage.
 */
function fieldErrorsFrom422(body: unknown): ContactErrors {
  const detail = (body as { detail?: unknown })?.detail;
  if (!Array.isArray(detail)) return {};

  const errors: ContactErrors = {};

  for (const item of detail) {
    const loc = (item as { loc?: unknown })?.loc;
    const field = Array.isArray(loc) ? loc[loc.length - 1] : null;

    if (field === "email") {
      errors.email = "That email address has a domain we cannot deliver to. Check it for a typo.";
    } else if (typeof field === "string" && field in errors === false) {
      // Wording stays ours rather than pydantic's: the raw message is written
      // for an API consumer ("String should have at most 100 characters") and
      // names the schema, not the thing on screen.
      errors[field as keyof ContactErrors] = "The server rejected this value. Shorten it and try again.";
    }
  }

  return errors;
}

export async function submitContact(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const values = readContactForm(formData);

  // The browser ran this too. It runs again because the browser's copy is a
  // convenience, not a control — this form posts fine with JavaScript off.
  const errors = validateContact(values);
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors, values };
  }

  const url = `${API_URL}/api/v1/contacts/`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(await forwardedFor()),
      },
      // Trimmed here as well as on the API, so what is stored matches what the
      // length check measured.
      body: JSON.stringify({
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // A mutation must never be served from, or written to, the data cache.
      cache: "no-store",
    });
  } catch (error) {
    // DNS failure, connection refused, or the timeout above.
    console.error(`[contact] POST to ${url} failed:`, error);
    return { status: "unavailable", values };
  }

  if (response.status === 201) {
    return { status: "sent" };
  }

  if (response.status === 429) {
    return { status: "rate_limited", retryAfterSeconds: retryAfterSeconds(response), values };
  }

  if (response.status === 422) {
    const body = await response.json().catch(() => null);
    const apiErrors = fieldErrorsFrom422(body);

    return Object.keys(apiErrors).length > 0
      ? { status: "invalid", errors: apiErrors, values }
      : { status: "unavailable", values };
  }

  // 5xx, or anything else unexpected. The visitor's problem is the same in
  // every case — the message did not arrive — so they get one clear answer and
  // the detail goes to the server log.
  console.error(`[contact] ${response.status} ${response.statusText} from ${url}`);
  return { status: "unavailable", values };
}
