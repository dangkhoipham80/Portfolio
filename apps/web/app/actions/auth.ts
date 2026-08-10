"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { login, logout as revokeTokens } from "@/lib/console-api";
import { retryAfterSeconds } from "@/lib/retry-after";
import {
  ACCESS_COOKIE,
  clearedSessionCookies,
  LOGIN_PATH,
  REFRESH_COOKIE,
  safeNextPath,
  sessionCookies,
} from "@/lib/session";
import {
  type SignInState,
  readSignInForm,
  validateSignIn,
} from "@/lib/sign-in";

/**
 * Sign in and sign out.
 *
 * Server Actions rather than route handlers for the same two reasons the
 * contact form uses one: `<form action={signIn}>` posts without JavaScript, so
 * the login screen works before hydration and after a bundle failure; and there
 * is no hand-rolled request/response contract for what is one function call.
 *
 * They are also the only place besides the refresh route that can write a
 * cookie — server components cannot — which is what puts the token exchange
 * here rather than in the page.
 */

/** Forward the caller's address so the API's per-IP login cap counts them. */
async function forwardedFor(): Promise<string | undefined> {
  const incoming = await headers();
  return incoming.get("x-forwarded-for") ?? undefined;
}

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const values = readSignInForm(formData);
  const next = safeNextPath(
    typeof formData.get("next") === "string" ? (formData.get("next") as string) : null,
  );

  // The browser ran this too. It runs again because the browser's copy is a
  // convenience, not a control — this form posts fine with JavaScript off.
  const errors = validateSignIn(values);
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors, email: values.email };
  }

  const result = await login(values.email.trim(), values.password, await forwardedFor());

  if (!result.ok) {
    if (result.reason === "unauthorized") {
      // No detail, on purpose. The API returns one 401 for a wrong password, an
      // unknown address, a deactivated account and an unverified one, so that a
      // caller cannot use the login screen to discover which addresses exist.
      // Repeating that answer here keeps the property.
      return { status: "rejected", email: values.email };
    }

    if (result.reason === "rate_limited") {
      return {
        status: "rate_limited",
        retryAfterSeconds: retryAfterSeconds(result.response),
        email: values.email,
      };
    }

    return { status: "unavailable", email: values.email };
  }

  const jar = await cookies();
  for (const cookie of sessionCookies(result.data)) {
    jar.set(cookie.name, cookie.value, cookie.options);
  }

  // Outside the try/catch shape above because redirect() works by throwing:
  // wrapping it swallows the redirect and returns the caller to the form with
  // a live session and no explanation.
  redirect(next);
}

/**
 * End the session, at the API as well as in the browser.
 *
 * Deleting the cookies alone would leave a token that still authenticates for
 * the rest of its hour — thirty days for the refresh token — for anyone who
 * captured it. The API keeps a token table and checks it on every request, so
 * revoking is what makes signing out mean something.
 */
export async function signOut(): Promise<void> {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;

  if (access) {
    // Best effort. A failure here must not strand someone in a session they
    // have asked to leave, so the cookies are cleared either way and the token
    // is left to expire on its own.
    await revokeTokens(access, refresh);
  }

  for (const cookie of clearedSessionCookies()) {
    jar.set(cookie.name, cookie.value, cookie.options);
  }

  redirect(LOGIN_PATH);
}

/*
 * The session-identity lookup deliberately does NOT live here.
 *
 * Every export of a "use server" module is published as a callable endpoint,
 * reachable by anyone who can guess its action id — so this file exports the
 * two things that genuinely have to be actions, and nothing else. Reading who
 * is signed in is an ordinary server-side function; it lives in
 * lib/admin-guard.ts, where it stays uncallable from outside.
 */
