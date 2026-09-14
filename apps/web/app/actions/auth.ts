"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  confirmPasswordReset,
  fetchCurrentUser,
  login,
  logout as revokeTokens,
  register,
  requestPasswordReset as askForResetLink,
  resendVerification,
  verifyEmail,
} from "@/lib/console-api";
import {
  type JoinState,
  readJoinForm,
  validateJoin,
} from "@/lib/join";
import {
  type ResendState,
  type VerifyEmailState,
} from "@/lib/verify-email";
import { readViewer } from "@/lib/viewer-server";
import {
  type NewPasswordState,
  type ResetRequestState,
  readNewPasswordForm,
  readResetRequestForm,
  readResetToken,
  validateNewPassword,
  validateResetRequest,
} from "@/lib/password-reset";
import { retryAfterSeconds } from "@/lib/retry-after";
import {
  ACCESS_COOKIE,
  clearedSessionCookies,
  landingPath,
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
  const asked = formData.get("next");
  // Empty fallback, so "they did not ask for anywhere" survives sanitising and
  // can be answered below by who they turn out to be. The default inside
  // safeNextPath is /admin, which is right for the console's own renewal flow
  // and wrong for a reader.
  const next = safeNextPath(typeof asked === "string" ? asked : null, "");

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

  redirect(await landing(next, result.data.access_token));
}

/**
 * Where a successful sign-in ends up.
 *
 * The rule itself is `landingPath` in lib/session.ts, shared with the sign-in
 * screen — the two used to decide separately, and the disagreement was an
 * infinite redirect. What this adds is the one fact the rule needs and only the
 * server can get: whether the account is an admin.
 *
 * The lookup costs one request, at sign-in, which is the one moment where being
 * wrong about this is most visible.
 */
async function landing(asked: string, accessToken: string): Promise<string> {
  const result = await fetchCurrentUser(accessToken);

  // The API answered the login and then would not say who it was for. Treating
  // that as "a reader" sends them to the site, which every account can read.
  return landingPath(asked, result.ok && result.data.roles.includes("admin"));
}

/**
 * Create a reader account.
 *
 * No cookie and no redirect, deliberately. The account lands in the API in
 * PENDING_VERIFICATION and cannot sign in until the link in the mail is
 * followed, so there is nothing yet to sign this browser in *with* — minting a
 * session here would be the one thing the verification step exists to prevent.
 * The screen says to go and check their mail.
 *
 * The success state says "if that address is new" rather than "we have created
 * your account", and that wording is load-bearing rather than cautious: the API
 * answers the same 202 to an address that already has an account, so a screen
 * claiming a new account existed would give that back in the copy — the same
 * leak one layer up. Same arrangement as requestPasswordReset below.
 */
export async function join(
  _previous: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const values = readJoinForm(formData);

  // The browser ran this too. It runs again because the browser's copy is a
  // convenience, not a control — this form posts fine with JavaScript off.
  const errors = validateJoin(values);
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors, values };
  }

  const result = await register(
    {
      email: values.email.trim(),
      password: values.password,
      full_name: values.full_name.trim(),
    },
    await forwardedFor(),
  );

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return {
        status: "rate_limited",
        retryAfterSeconds: retryAfterSeconds(result.response),
        values,
      };
    }

    return { status: "unavailable", values };
  }

  return { status: "sent", email: values.email.trim() };
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

/**
 * Ask for a reset link.
 *
 * The success state says "if that address has an account" rather than "we have
 * sent you a mail", and that wording is load-bearing rather than cautious. The
 * API answers the same 200 either way so the form cannot be used to discover
 * which addresses exist; a screen that claimed a mail had been sent would give
 * that back in the copy, which is the same leak one layer up.
 */
export async function requestPasswordReset(
  _previous: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = readResetRequestForm(formData);

  // The browser ran this too. It runs again because the browser's copy is a
  // convenience, not a control — this form posts fine with JavaScript off.
  const errors = validateResetRequest(email);
  if (errors.email) {
    return { status: "invalid", errors, email };
  }

  const result = await askForResetLink(email.trim(), await forwardedFor());

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return {
        status: "rate_limited",
        retryAfterSeconds: retryAfterSeconds(result.response),
        email,
      };
    }

    // `unauthorized` cannot happen on this route — it takes no token — but it
    // is part of ApiResult, and folding it in here beats a switch that only
    // looks exhaustive. Every remaining case means the same thing to the person
    // waiting: no link is coming.
    return { status: "unavailable", email };
  }

  return { status: "sent", email };
}

/**
 * Spend a reset link on a new password.
 *
 * No redirect and no cookie. The API revokes every token the account holds as
 * part of the reset — which is the point of a reset, and the reason a stolen
 * session cannot survive one — so there is nothing to sign this browser in
 * with. The screen says so and sends them to /login.
 */
export async function resetPassword(
  _previous: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const token = readResetToken(
    typeof formData.get("token") === "string" ? (formData.get("token") as string) : undefined,
  );

  // The field is hidden and filled by the page from the URL, so an empty or
  // mangled one means a truncated link rather than anything the person did.
  if (!token) return { status: "token_rejected" };

  const values = readNewPasswordForm(formData);

  const errors = validateNewPassword(values);
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors };
  }

  const result = await confirmPasswordReset(token, values.password);

  if (result.ok) return { status: "done" };

  if (result.reason === "token_rejected") return { status: "token_rejected" };

  if (result.reason === "weak_password") {
    // The API's rule turned out to be stricter than this app's copy of it.
    // Landing it on the field beats reporting it as an outage.
    return {
      status: "invalid",
      errors: { password: "The API refused this password. Try a longer one." },
    };
  }

  if (result.reason === "rate_limited") {
    return { status: "rate_limited", retryAfterSeconds: retryAfterSeconds(result.response) };
  }

  return { status: "unavailable" };
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


/**
 * Confirm an address from the link in the mail.
 *
 * A POST from a real form rather than something done during the render of a GET.
 * The token is single-use, and a GET that spends it is fired by every link
 * prefetcher, mail scanner and preview fetcher that meets the URL — the person
 * then clicks it and is told their link has already been used, which is true and
 * baffling.
 *
 * No cookie and no redirect. Confirming an address is not signing in: the screen
 * says so and offers the sign-in link, carrying wherever they were going.
 */
export async function confirmEmail(
  _previous: VerifyEmailState,
  formData: FormData,
): Promise<VerifyEmailState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token.trim()) return { status: "token_rejected" };

  const result = await verifyEmail(token.trim());

  if (result.ok) return { status: "done" };
  if (result.reason === "token_rejected") return { status: "token_rejected" };
  return { status: "unavailable" };
}

/**
 * Mail a fresh verification link to the signed-in reader.
 *
 * The address comes from the session and is never a parameter. Taking one would
 * make this an endpoint for sending mail to any address on request — a Server
 * Action is a POST endpoint the browser can reach directly, so "the client only
 * ever passes its own address" is not a property this could have.
 *
 * Answers the same way whether or not the address needed a link, for the reason
 * requestPasswordReset does.
 */
export async function resendVerificationEmail(): Promise<ResendState> {
  const viewer = await readViewer();
  // Signed out, or already confirmed. Either way there is nothing to send, and
  // the answer does not distinguish them.
  if (!viewer || viewer.isVerified) return { status: "sent" };

  const result = await resendVerification(viewer.email, await forwardedFor());

  if (result.ok) return { status: "sent" };
  if (result.reason === "rate_limited") return { status: "rate_limited" };
  return { status: "unavailable" };
}
