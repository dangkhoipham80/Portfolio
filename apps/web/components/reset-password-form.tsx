"use client";

/*
 * A client component for the same reasons the sign-in form is one:
 * `useActionState` to hold the result of the submission, `useState` for the
 * errors raised on submit, and `useRef` to move focus to the field that needs
 * fixing. None of that can be done in CSS or on the server.
 *
 * The form still posts without JavaScript: `action` is the Server Action
 * itself, so the browser's native form POST reaches it and the page re-renders
 * with whatever it returned. That matters more here than anywhere else on the
 * site — this is the screen someone reaches when they are already locked out.
 */

import { useActionState, useRef, useState } from "react";
import Link from "next/link";

import { resetPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { eyebrowClasses } from "@/components/ui/eyebrow";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { ScreenTitle } from "@/components/ui/screen-title";
import { Wire } from "@/components/ui/wire";
import {
  type NewPasswordErrors,
  type NewPasswordField,
  type NewPasswordState,
  INITIAL_NEW_PASSWORD_STATE,
  MIN_PASSWORD_LENGTH,
  RESET_LINK_LIFETIME,
  readNewPasswordForm,
  validateNewPassword,
} from "@/lib/password-reset";
import { cn } from "@/lib/cn";
import { formatWait } from "@/lib/retry-after";

const FIELD_ORDER: NewPasswordField[] = ["password", "confirm"];

/**
 * The way off this screen, in the quiet mono treatment /login uses at its foot.
 *
 * Every state below renders exactly one, and to a different place — which is
 * the point. The footer link used to live on the page, so the "Password
 * changed" state offered "Go to sign in" with "Back to sign in" directly
 * underneath it: two links, one destination, stacked. Two ways to do the same
 * thing reads as a mistake rather than as generosity.
 */
function WayOut({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <p className={cn(eyebrowClasses, "mt-10")}>
      <Link href={href} className="underline underline-offset-4 hover:text-primary">
        {children}
      </Link>
    </p>
  );
}

/** The same lower-case mono log line the other two forms end on. */
function StatusLine({
  state,
  isPending,
  errorCount,
}: {
  state: NewPasswordState;
  isPending: boolean;
  errorCount: number;
}) {
  const mono = "font-mono text-xs";

  if (isPending) {
    return <p className={`${mono} text-primary`}>saving…</p>;
  }

  if (state.status === "rate_limited") {
    return (
      <Notice>
        Too many attempts from this address. Try again{" "}
        {formatWait(state.retryAfterSeconds)}.
      </Notice>
    );
  }

  if (state.status === "unavailable") {
    return (
      <Notice>
        The API is not reachable, so the password was not changed. Nothing is
        wrong with what you typed — try again shortly.
      </Notice>
    );
  }

  if (errorCount > 0) {
    return (
      <p className={`${mono} text-destructive-text`}>
        {errorCount} field{errorCount === 1 ? "" : "s"}{" "}
        {errorCount === 1 ? "needs" : "need"} fixing
      </p>
    );
  }

  return <p className={`${mono} text-muted-foreground`}>POST /auth/password-reset-confirm</p>;
}

/**
 * What a spent, expired or invented link looks like.
 *
 * One screen for all three, because the API answers them identically on purpose
 * — telling them apart would say whether a given token had ever existed — and
 * because the remedy is the same in every case.
 *
 * Rendered by this component rather than by the page so that a link which
 * *looks* valid and is refused on submit lands somewhere identical to one that
 * was malformed on arrival. Two different dead ends for the same dead end is
 * how a person concludes the site is broken rather than the link.
 *
 * It carries its own heading, as every state in this file does. They were on
 * the page to begin with, which left "set it here, then sign in again" standing
 * above a screen with nothing to set — standing copy contradicting its own
 * outcome, which reads as nothing having happened.
 */
export function DeadLink() {
  return (
    <>
      <ScreenTitle>This link has expired</ScreenTitle>
      <p className="mt-4 text-muted-foreground">
        Reset links last {RESET_LINK_LIFETIME} and work once. If it has been
        longer than that, or the link has already been used, ask for a fresh one.
      </p>
      <p className="mt-8">
        <Link
          href="/forgot-password"
          className="underline underline-offset-4 hover:text-primary"
        >
          Send a new link
        </Link>
      </p>
      <WayOut href="/login">Back to sign in</WayOut>
    </>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(
    resetPassword,
    INITIAL_NEW_PASSWORD_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [clientErrors, setClientErrors] = useState<NewPasswordErrors>({});

  /*
   * Fold the Server Action's verdict into the one error map when it arrives —
   * React's "adjusting state when a prop changes" pattern, during render rather
   * than in an effect. Keeping two maps and merging at render time fails in
   * both directions; see the longer note in contact-form.tsx.
   */
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    setClientErrors(state.status === "invalid" ? state.errors : {});
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const errors = validateNewPassword(readNewPasswordForm(new FormData(event.currentTarget)));

    if (Object.keys(errors).length === 0) return;

    // Stop the round trip. It also stops the token being spent on a submission
    // that was never going to succeed — the API revokes the link whether or not
    // the password it carried was any good.
    event.preventDefault();
    setClientErrors(errors);

    const firstBad = FIELD_ORDER.find((field) => errors[field]);
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
    }
  }

  function clearError(field: NewPasswordField) {
    // Deletes the key rather than setting it to undefined. `{ ...prev, x:
    // undefined }` keeps the key, so Object.keys().length still counts it and
    // the live region announces a field needing fixing with nothing marked
    // invalid. Same shape as handleBlur in contact-form.tsx.
    setClientErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  if (state.status === "token_rejected") return <DeadLink />;

  if (state.status === "done") {
    return (
      <>
        <ScreenTitle>Password changed</ScreenTitle>
        {/*
          Says what else happened, because it is not obvious and it is the whole
          point: reset_password() revokes every token the account holds, which
          is what makes a reset the remedy for a stolen session rather than just
          a new password sitting next to an old live one.
        */}
        <p className="mt-4 text-muted-foreground">
          Every session this account had is now signed out, on every device. Sign
          in again with the new password.
        </p>
        <p className="mt-8">
          <Link href="/login" className="underline underline-offset-4 hover:text-primary">
            Go to sign in
          </Link>
        </p>
        <WayOut href="/">Back to the site</WayOut>
      </>
    );
  }

  const errorCount = Object.keys(clientErrors).length;

  return (
    <>
      <ScreenTitle>Choose a new password</ScreenTitle>
      <p className="mt-4 text-muted-foreground">
        Set it here, then sign in again. Every session this account currently has
        will be closed.
      </p>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className="mt-10 flex flex-col gap-5"
        noValidate
      >
        {/* Carried in the form rather than read from the URL by the action: a
            Server Action does not get the page's query string. Re-validated
            server-side regardless. */}
        <input type="hidden" name="token" value={token} />

        <TextField
          name="password"
          label="New password"
          type="password"
          // "new-password" rather than "current-password", which is what tells
          // a password manager to offer to generate and then to save one. With
          // the wrong value it offers the *old* password instead, on the one
          // screen where that is guaranteed wrong.
          autoComplete="new-password"
          autoFocus
          // The rule, stated before it can be broken. `meta` is the
          // right-aligned slot for exactly this kind of constraint — see
          // field.tsx.
          meta={
            <span className="font-mono text-xs text-muted-foreground">
              {MIN_PASSWORD_LENGTH}+ characters
            </span>
          }
          error={clientErrors.password}
          onBlur={() => clearError("password")}
        />

        <TextField
          name="confirm"
          label="New password again"
          type="password"
          autoComplete="new-password"
          // The password is never echoed back and the link is spent on submit,
          // so a typo would only surface at the sign-in screen with no way back.
          hint="The link is used up once this is submitted, so it is worth checking."
          error={clientErrors.confirm}
          onBlur={() => clearError("confirm")}
        />

        <Wire active={isPending} />

        <div className="flex flex-col gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Set the new password"}
          </Button>

          {/* One polite live region, so a screen reader hears the verdict
              without the focus being moved out from under it. */}
          <div aria-live="polite">
            <StatusLine state={state} isPending={isPending} errorCount={errorCount} />
          </div>
        </div>
      </form>

      <WayOut href="/login">Back to sign in</WayOut>
    </>
  );
}
