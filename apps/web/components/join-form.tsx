"use client";

/*
 * A client component for the same reasons the sign-in form is one:
 * `useActionState` to hold the result, `useState` for the errors raised as you
 * leave a field, and `useRef` to move focus to the field that needs fixing.
 *
 * The form still posts without JavaScript — `action` is the Server Action
 * itself, so the browser's native POST reaches it and the page re-renders with
 * whatever it returned.
 */

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import { join } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Wire } from "@/components/ui/wire";
import {
  type JoinErrors,
  type JoinField,
  INITIAL_JOIN_STATE,
  MIN_PASSWORD_LENGTH,
  readJoinForm,
  validateJoin,
} from "@/lib/join";
import { formatWait } from "@/lib/retry-after";

export function JoinForm({ next }: { next: string }) {
  // `next` is not posted with the form. Creating an account does not sign
  // anyone in — the address has to be confirmed first — so there is nothing to
  // redirect. It is carried on the sign-in link in the success state instead.
  const [state, formAction, isPending] = useActionState(join, INITIAL_JOIN_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const [clientErrors, setClientErrors] = useState<JoinErrors>({});

  /*
   * Fold the Server Action's verdict into the one error map when it arrives —
   * during render rather than in an effect, the same pattern as the sign-in
   * form. Keeping two maps and merging at render time fails in both directions.
   */
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    setClientErrors(state.status === "invalid" ? state.errors : {});
  }

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-5">
        <Notice tone="success">
          {/*
            "If that address is new" rather than "your account is ready", and
            the wording is load-bearing: the API answers the same way for an
            address that already has an account, so that it cannot be used to
            find out which addresses do. A screen claiming a new account would
            give that back in the copy.
          */}
          If that address is new, a link is on its way to {state.email}. Open it
          to confirm the address — the account cannot sign in until you do.
        </Notice>
        <p className="text-sm text-muted-foreground">
          Already confirmed it?{" "}
          <Link
            // Carries where they were going, so confirming the address and
            // signing in lands them back on the article they came from rather
            // than on the front page.
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="text-primary underline underline-offset-4"
          >
            Sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  const values = "values" in state ? state.values : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const errors = validateJoin(readJoinForm(new FormData(event.currentTarget)));
    if (Object.keys(errors).length === 0) return;

    // Stop the round trip: an empty submit would otherwise spend one of five
    // rate-limited attempts to be told what we already know.
    event.preventDefault();
    setClientErrors(errors);

    const firstBad = Object.keys(errors)[0];
    formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
  }

  /**
   * Clear a field's error when it is left.
   *
   * Deletes the key rather than setting it to undefined, for the reason the
   * sign-in form records: an `undefined` value still counts in
   * `Object.keys().length`, so the live region announces a field that is fine.
   */
  function clearError(field: JoinField) {
    setClientErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  const errorCount = Object.keys(clientErrors).length;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      noValidate
    >
      <TextField
        name="full_name"
        label="Name"
        autoComplete="name"
        autoFocus
        maxLength={80}
        required
        hint="What your comments are signed with. Change it any time."
        defaultValue={values?.full_name ?? ""}
        error={clientErrors.full_name}
        onBlur={() => clearError("full_name")}
      />

      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        hint="Only used to confirm the address and to sign you in."
        defaultValue={values?.email ?? ""}
        error={clientErrors.email}
        onBlur={() => clearError("email")}
      />

      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        // The rule up front rather than after a rejected submit. It is one
        // number and it is the only one.
        meta={
          <span className="font-mono text-xs text-muted-foreground">
            {MIN_PASSWORD_LENGTH}+ characters
          </span>
        }
        error={clientErrors.password}
        onBlur={() => clearError("password")}
      />

      <Wire active={isPending} />

      <div className="flex flex-col gap-4">
        <Button type="submit" disabled={isPending}>
          {/* The button says what happens, and the toast that follows says the
              same word back. */}
          {isPending ? "Creating…" : "Create account"}
        </Button>

        {/* One polite live region, so a screen reader hears the verdict without
            the focus being moved out from under it. */}
        <div aria-live="polite">
          <Status
            errorCount={errorCount}
            isPending={isPending}
            rateLimited={
              state.status === "rate_limited" ? state.retryAfterSeconds : undefined
            }
            unavailable={state.status === "unavailable"}
          />
        </div>
      </div>
    </form>
  );
}

/**
 * Everything the form has to say, under the fields.
 *
 * Lower-case mono rather than the uppercase eyebrow treatment, exactly as the
 * sign-in form's status line: this carries a route and a budget, and
 * "POST /AUTH/REGISTER" reads as shouting rather than as a path.
 */
function Status({
  errorCount,
  isPending,
  rateLimited,
  unavailable,
}: {
  errorCount: number;
  isPending: boolean;
  rateLimited?: number | null;
  unavailable: boolean;
}) {
  const mono = "font-mono text-xs";

  if (isPending) return <p className={`${mono} text-primary`}>creating…</p>;

  if (rateLimited !== undefined) {
    return (
      <Notice>
        Too many sign-ups from this address. Try again {formatWait(rateLimited)}.
      </Notice>
    );
  }

  if (unavailable) {
    return (
      <Notice>
        The API is not reachable, so nothing was created. Try again shortly.
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

  return (
    <p className={`${mono} text-muted-foreground`}>POST /auth/register · 5 per hour</p>
  );
}
