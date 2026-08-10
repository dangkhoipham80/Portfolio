"use client";

/*
 * A client component for the same three reasons the contact form is one:
 * `useActionState` to hold the result of the submission, `useState` for the
 * errors raised as you leave a field, and `useRef` to move focus to the field
 * that needs fixing. None of that can be done in CSS or on the server.
 *
 * The form still posts without JavaScript: `action` is the Server Action
 * itself, so the browser's native form POST reaches it and the page re-renders
 * with whatever it returned.
 */

import { useActionState, useRef, useState } from "react";

import { signIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Wire } from "@/components/ui/wire";
import { formatWait } from "@/lib/retry-after";
import {
  type SignInErrors,
  type SignInField,
  type SignInState,
  INITIAL_SIGN_IN_STATE,
  readSignInForm,
  validateSignIn,
} from "@/lib/sign-in";

/**
 * One place for everything the form has to say, under the fields.
 *
 * Lower-case mono rather than the uppercase eyebrow treatment — this line
 * carries a route and a verb, and "POST /AUTH/LOGIN" reads as shouting rather
 * than as a path. A log line is what this is.
 */
function StatusLine({
  state,
  isPending,
  errorCount,
}: {
  state: SignInState;
  isPending: boolean;
  errorCount: number;
}) {
  const mono = "font-mono text-xs";

  if (isPending) {
    return <p className={`${mono} text-primary`}>checking…</p>;
  }

  if (state.status === "rejected") {
    return (
      <p className={`${mono} text-destructive-text`}>
        that email and password don&rsquo;t match
      </p>
    );
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
        The API is not reachable, so this sign-in could not be checked. Nothing
        is wrong with your details — try again shortly.
      </Notice>
    );
  }

  if (errorCount > 0) {
    return (
      <p className={`${mono} text-destructive-text`}>
        {errorCount} field{errorCount === 1 ? "" : "s"}{" "}
        {errorCount === 1 ? "needs" : "need"} filling in
      </p>
    );
  }

  // The endpoint and the budget, stated up front — the same line the contact
  // form ends on, and the same reason: the person reading it wrote the backend.
  return <p className={`${mono} text-muted-foreground`}>POST /auth/login · 10 per 15 min</p>;
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(signIn, INITIAL_SIGN_IN_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const [clientErrors, setClientErrors] = useState<SignInErrors>({});

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

  // The address is echoed back so a rejected attempt does not make someone
  // retype it. The password never is — a value the browser did not put there
  // should not come back down the wire, and retyping it is the point.
  const email = state.status === "idle" ? "" : state.email;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const values = readSignInForm(new FormData(event.currentTarget));
    const errors = validateSignIn(values);

    if (Object.keys(errors).length === 0) return;

    // Stop the round trip: an empty submit would otherwise spend one of ten
    // rate-limited attempts to be told what we already know.
    event.preventDefault();
    setClientErrors(errors);

    const firstBad = Object.keys(errors)[0];
    formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
  }

  /**
   * Clear a field's error when it is left.
   *
   * Deletes the key rather than setting it to undefined. `{ ...prev, email:
   * undefined }` keeps `email` in the object, so Object.keys().length still
   * counted it and the live region announced "1 field needs filling in" after a
   * single Tab off the autofocused field — with nothing marked invalid, since
   * aria-invalid is only set for a non-empty message. Same shape as
   * handleBlur in contact-form.tsx.
   *
   * Nothing is validated on blur here: both fields are a claim about an
   * existing account, so there is nothing to check until they are submitted.
   */
  function clearError(field: SignInField) {
    setClientErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  const errorCount = Object.keys(clientErrors).length;

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {/* Carried through the action so sign-in returns to the page that
          bounced, not a generic landing. Validated server-side regardless. */}
      <input type="hidden" name="next" value={next} />

      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        // The only field worth autofocusing: there is one form on the page and
        // nothing above it to read past.
        autoFocus
        defaultValue={email}
        error={clientErrors.email}
        onBlur={() => clearError("email")}
      />

      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={clientErrors.password}
        onBlur={() => clearError("password")}
      />

      <Wire active={isPending} />

      <div className="flex flex-col gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </Button>

        {/* One polite live region, so a screen reader hears the verdict without
            the focus being moved out from under it. */}
        <div aria-live="polite">
          <StatusLine state={state} isPending={isPending} errorCount={errorCount} />
        </div>
      </div>
    </form>
  );
}
