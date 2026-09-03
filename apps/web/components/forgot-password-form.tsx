"use client";

/*
 * A client component for the same reasons the sign-in form is one:
 * `useActionState` to hold the result of the submission, `useState` for the
 * error raised as the field is left, and `useRef` to move focus to it. None of
 * that can be done in CSS or on the server.
 *
 * The form still posts without JavaScript: `action` is the Server Action
 * itself, so the browser's native form POST reaches it and the page re-renders
 * with whatever it returned.
 */

import { useActionState, useRef, useState } from "react";

import { requestPasswordReset } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { ScreenTitle } from "@/components/ui/screen-title";
import { Wire } from "@/components/ui/wire";
import {
  type ResetRequestErrors,
  type ResetRequestState,
  INITIAL_RESET_REQUEST_STATE,
  RESET_LINK_LIFETIME,
  readResetRequestForm,
  validateResetRequest,
} from "@/lib/password-reset";
import { formatWait } from "@/lib/retry-after";

/**
 * Everything the form has to say, under the field.
 *
 * The same lower-case mono log line as the sign-in form, and the same reason:
 * this line carries a route and a budget, and the person reading it wrote the
 * backend it names.
 */
function StatusLine({ state, isPending }: { state: ResetRequestState; isPending: boolean }) {
  const mono = "font-mono text-xs";

  if (isPending) {
    return <p className={`${mono} text-primary`}>sending…</p>;
  }

  if (state.status === "rate_limited") {
    return (
      <Notice>
        Too many requests from this address. Try again{" "}
        {formatWait(state.retryAfterSeconds)}.
      </Notice>
    );
  }

  if (state.status === "unavailable") {
    return (
      <Notice>
        The API is not reachable, so no link could be sent. Nothing is wrong with
        the address — try again shortly.
      </Notice>
    );
  }

  /*
   * A field error is deliberately not repeated here.
   *
   * The sign-in form's live region announces a *count* because it has two
   * fields and the count is information the fields themselves do not carry.
   * There is one field here: TextField already prints the message and points
   * `aria-describedby` at it, and handleSubmit moves focus onto that field — so
   * repeating the sentence in a live region announces it twice, once from the
   * region and once from the focused control.
   */
  return (
    <p className={`${mono} text-muted-foreground`}>
      POST /auth/password-reset-request · 5 per hour
    </p>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    INITIAL_RESET_REQUEST_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [clientErrors, setClientErrors] = useState<ResetRequestErrors>({});

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

  const email = state.status === "idle" ? "" : state.email;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const errors = validateResetRequest(readResetRequestForm(new FormData(event.currentTarget)));

    if (!errors.email) return;

    // Stop the round trip: a malformed submit would otherwise spend one of five
    // hourly attempts to be told what we already know.
    event.preventDefault();
    setClientErrors(errors);
    formRef.current?.querySelector<HTMLElement>('[name="email"]')?.focus();
  }

  if (state.status === "sent") {
    /*
      The heading and the prose live in here rather than on the page, and that
      is not tidiness.

      They started on the page, above this component, which meant the words
      "Enter the address on the account and the API will mail a link" stayed on
      screen after the link had been asked for — an instruction for a form that
      is no longer there. A screen whose standing copy contradicts its own
      outcome is how a person concludes nothing happened.

      So each state supplies its own, and the page keeps only what is true of
      all of them: the eyebrow and the way out at the foot.
    */
    return (
      <>
        <ScreenTitle>Check that inbox</ScreenTitle>
        {/*
          "If there is an account" is not hedging. The API answers the same 200
          whether or not the address is registered, so that this form cannot be
          used to discover which addresses exist — and copy claiming a mail had
          definitely been sent would give that property straight back.
        */}
        <p className="mt-4 text-muted-foreground">
          If there is an account for{" "}
          <span className="font-mono text-sm text-foreground">{state.email}</span>, a
          reset link is on its way. It is good for {RESET_LINK_LIFETIME}, and
          asking again replaces it.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing arrived? Check spam, then{" "}
          {/*
            A plain <a>, not next/link and not an onClick.

            Getting back to a blank form means discarding a useActionState
            result, and there is no reset API for one — a client-side navigation
            to this same route would remount the component with the stale result
            still reachable on the next submit. A full document load is the
            honest way to clear it, and it is the one that also works with
            JavaScript off, which the rest of this form does.

            eslint-disable-next-line is the point, not a workaround: the rule
            exists to stop an <a> throwing away client-side navigation, and
            throwing it away is precisely what is wanted here.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/forgot-password" className="underline underline-offset-4 hover:text-primary">
            try a different address
          </a>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <ScreenTitle>Reset your password</ScreenTitle>
      <p className="mt-4 text-muted-foreground">
        Enter the address on the account and the API will mail a link to set a
        new password. The link works once.
      </p>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className="mt-10 flex flex-col gap-5"
        noValidate
      >
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="username"
          // The only field on the page, and nothing above it to read past.
          autoFocus
          defaultValue={email}
          error={clientErrors.email}
          // Nothing is validated on blur: the address is a claim about an
          // existing account, so there is nothing to check until it is
          // submitted. This only clears an error the submit already raised.
          onBlur={() => setClientErrors({})}
        />

        <Wire active={isPending} />

        <div className="flex flex-col gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sending…" : "Email me a reset link"}
          </Button>

          {/* One polite live region, so a screen reader hears the verdict
              without the focus being moved out from under it. */}
          <div aria-live="polite">
            <StatusLine state={state} isPending={isPending} />
          </div>
        </div>
      </form>
    </>
  );
}
